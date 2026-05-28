import { convertToModelMessages, streamText } from "ai";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import {
  assertLatestTurnRewriteTarget,
  assertThreadReadyForLatestRewrite,
  assertThreadReadyForNewTurn,
  buildGenerationMessages,
  buildGenerationSystemPrompt,
  loadThreadGenerationRuntime,
  ThreadGenerationServiceError,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/thread-generation-service";
import {
  beginTurn,
  commitTurn,
  failTurn,
  markTurnStreaming,
} from "@/lib/data/turns";
import { materializeSnapshotForTurn } from "@/lib/ai/continuity";
import { getWorldSnapshot } from "@/lib/data/world-state";
import { materializeDurableSnapshot } from "@/lib/ai/state-materializer";
import { buildRecentSceneMessages, createTextMessage } from "@/lib/threads/read-model";
import { chatTurnRequestSchema, getValidationErrorMessage } from "@/lib/validation";
import { MAX_CHAT_TURN_TEXT, buildChatTurnLimitMessage } from "@/lib/chat-limits";

const chatRouteRequestSchema = z
  .object({
    threadId: z.string().uuid(),
    branchId: chatTurnRequestSchema.shape.branchId,
    expectedHeadTurnId: chatTurnRequestSchema.shape.expectedHeadTurnId,
    text: z.string().trim().max(MAX_CHAT_TURN_TEXT, buildChatTurnLimitMessage()).optional(),
    mode: z.enum(["new", "regenerate", "user"]).optional(),
  })
  .refine(
    (data) => {
      if (data.mode !== "regenerate") {
        return typeof data.text === "string" && data.text.length > 0;
      }
      return true;
    },
    {
      message: "Write a message before sending.",
      path: ["text"],
    }
  )
  .refine(
    (data) => {
      if (data.mode === "regenerate" || data.mode === "user") {
        return typeof data.expectedHeadTurnId === "string" && data.expectedHeadTurnId.length > 0;
      }
      return true;
    },
    {
      message: "Expected head turn ID is required for rewrites.",
      path: ["expectedHeadTurnId"],
    }
  );

function toRouteError(error: unknown) {
  if (error instanceof ThreadGenerationServiceError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  return Response.json({ error: "Fantasia could not start that turn." }, { status: 409 });
}

export async function POST(request: Request) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = chatRouteRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json(
      { error: getValidationErrorMessage(parsedBody.error, "Invalid chat payload.") },
      { status: 400 },
    );
  }

  const { branchId, expectedHeadTurnId, text, threadId, mode = "new" } = parsedBody.data;

  let runtime: Awaited<ReturnType<typeof loadThreadGenerationRuntime>>;
  try {
    runtime = await loadThreadGenerationRuntime({
      supabase: context.supabase,
      userId: context.user.id,
      threadId,
    });
    if (mode === "new") {
      assertThreadReadyForNewTurn(runtime.threadView);
    } else {
      assertThreadReadyForLatestRewrite(runtime.threadView);
    }
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  if (runtime.threadView.activeBranch.id !== branchId) {
    return Response.json(
      { error: "The active branch changed before this turn was sent." },
      { status: 409 },
    );
  }

  let reservedTurn;
  let system;
  let messages;
  try {
    if (mode === "new") {
      reservedTurn = await beginTurn(context.supabase, {
        branchId,
        expectedHeadTurnId,
        text: text!,
      });
      await markTurnStreaming(context.supabase, reservedTurn.thread_id, reservedTurn.id);

      const userMessage = createTextMessage({
        id: `${reservedTurn.id}:user`,
        role: "user",
        text: text!,
        metadata: {
          createdAt: reservedTurn.created_at,
          turnId: reservedTurn.id,
          branchId,
        },
      });

      system = buildGenerationSystemPrompt({
        runtime,
        snapshot: runtime.threadView.headSnapshot,
      });

      messages = await convertToModelMessages(
        buildGenerationMessages({
          recentSceneMessages: runtime.threadView.recentSceneMessages,
          pendingMessages: [userMessage],
        }),
      );
    } else {
      const latestTurn = assertLatestTurnRewriteTarget({
        threadView: runtime.threadView,
        branchId,
        expectedHeadTurnId: expectedHeadTurnId!,
      });

      const preservedUserPayload =
        mode === "regenerate" && Array.isArray(latestTurn.user_input_payload)
          ? latestTurn.user_input_payload
          : undefined;
      const userText = mode === "regenerate" ? latestTurn.user_input_text : text!;

      reservedTurn = await beginTurn(context.supabase, {
        branchId,
        expectedHeadTurnId: expectedHeadTurnId!,
        text: userText,
        payload: preservedUserPayload,
        parentTurnIdOverride: latestTurn.parent_turn_id,
        forceParentOverride: true,
        hiddenFromTranscript: latestTurn.user_input_hidden,
        starterSeed: latestTurn.starter_seed,
      });
      await markTurnStreaming(context.supabase, reservedTurn.thread_id, reservedTurn.id);

      const rewrittenUserMessage = createTextMessage({
        id: `${reservedTurn.id}:user`,
        role: "user",
        text: userText,
        metadata: {
          createdAt: reservedTurn.created_at,
          turnId: reservedTurn.id,
          branchId,
          hiddenFromTranscript: latestTurn.user_input_hidden,
          starterSeed: latestTurn.starter_seed,
        },
      });

      const previousSnapshotRecord = latestTurn.parent_turn_id
        ? await getWorldSnapshot(context.supabase, latestTurn.parent_turn_id)
        : null;
      const previousSnapshot = previousSnapshotRecord
        ? await materializeDurableSnapshot(
            context.supabase,
            threadId,
            branchId,
            latestTurn.parent_turn_id!,
            previousSnapshotRecord,
          )
        : null;

      system = buildGenerationSystemPrompt({
        runtime,
        snapshot: previousSnapshot,
      });

      const contextTurns = runtime.threadView.turns.slice(0, -1);
      messages = await convertToModelMessages(
        buildGenerationMessages({
          recentSceneMessages: buildRecentSceneMessages(contextTurns),
          pendingMessages: [rewrittenUserMessage],
        }),
      );
    }
  } catch (error) {
    return toRouteError(error);
  }

  let turnSettled = false;
  let result;
  try {
    const model = createLanguageModel(runtime.connection, runtime.threadView.thread.model_id);
    result = streamText({
      model,
      system,
      messages,
      temperature: runtime.generationSettings.temperature,
      topP: runtime.generationSettings.topP,
      maxOutputTokens: runtime.generationSettings.maxOutputTokens,
      onError: async ({ error }) => {
        if (turnSettled) {
          return;
        }

        turnSettled = true;
        await failTurn(context.supabase, {
          branchId,
          turnId: reservedTurn.id,
          failureCode: "generation_error",
          failureMessage:
            error instanceof Error ? error.message : "The model stream failed before completion.",
        }).catch((persistError) => {
          console.error("Failed to persist streaming failure.", {
            threadId,
            branchId,
            turnId: reservedTurn.id,
            error:
              persistError instanceof Error
                ? persistError.message
                : String(persistError),
          });
        });
      },
      onFinish: async (event) => {
        if (turnSettled) {
          return;
        }

        turnSettled = true;
        try {
          await commitTurn(context.supabase, {
            branchId,
            turnId: reservedTurn.id,
            assistantText: event.text,
            provider: event.model.provider,
            model: event.model.modelId,
            connectionLabel: runtime.connection.label,
            finishReason: event.finishReason ?? null,
            totalTokens: event.totalUsage.totalTokens ?? null,
            promptTokens: event.totalUsage.inputTokens ?? null,
            completionTokens: event.totalUsage.outputTokens ?? null,
          });
          await materializeSnapshotForTurn({
            supabase: context.supabase,
            userId: context.user.id,
            threadId,
            turnId: reservedTurn.id,
            connection: runtime.brainConnection,
            modelId: runtime.brainModelId,
            character: runtime.character.character,
          });
        } catch (error) {
          await failTurn(context.supabase, {
            branchId,
            turnId: reservedTurn.id,
            failureCode: "commit_error",
            failureMessage:
              error instanceof Error ? error.message : "Fantasia could not persist the completed turn.",
          }).catch(() => undefined);
          throw error;
        }
      },
    });
  } catch (error) {
    if (!turnSettled) {
      turnSettled = true;
      await failTurn(context.supabase, {
        branchId,
        turnId: reservedTurn.id,
        failureCode: "generation_error",
        failureMessage:
          error instanceof Error ? error.message : "Failed to initialize generation stream.",
      }).catch((persistError) => {
        console.error("Failed to persist initialization failure.", {
          threadId,
          branchId,
          turnId: reservedTurn.id,
          error:
            persistError instanceof Error
              ? persistError.message
              : String(persistError),
        });
      });
    }
    return toRouteError(error);
  }

  return result.toUIMessageStreamResponse({
    generateMessageId: () => `${reservedTurn.id}:assistant`,
    messageMetadata: () => ({
      provider: runtime.connection.provider,
      model: runtime.threadView.thread.model_id,
      connectionLabel: runtime.connection.label,
      branchId,
      turnId: reservedTurn.id,
    }),
  });
}
