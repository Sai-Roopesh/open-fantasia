import { convertToModelMessages, streamText } from "ai";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createLanguageModel } from "@/lib/ai/provider-factory";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import {
  assertThreadReadyForNewTurn,
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
import { scheduleTaskDrain } from "@/lib/jobs/schedule-task-drain";
import { createTextMessage } from "@/lib/threads/read-model";
import { chatTurnRequestSchema } from "@/lib/validation";

const chatRouteRequestSchema = z.object({
  threadId: z.string().uuid(),
  branchId: chatTurnRequestSchema.shape.branchId,
  expectedHeadTurnId: chatTurnRequestSchema.shape.expectedHeadTurnId,
  text: chatTurnRequestSchema.shape.text,
});

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
    return Response.json({ error: "Invalid chat payload." }, { status: 400 });
  }

  const { branchId, expectedHeadTurnId, text, threadId } = parsedBody.data;

  let runtime: Awaited<ReturnType<typeof loadThreadGenerationRuntime>>;
  try {
    runtime = await loadThreadGenerationRuntime({
      supabase: context.supabase,
      userId: context.user.id,
      threadId,
    });
    assertThreadReadyForNewTurn(runtime.threadView);
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
  try {
    reservedTurn = await beginTurn(context.supabase, {
      branchId,
      expectedHeadTurnId,
      text,
    });
    await markTurnStreaming(context.supabase, reservedTurn.thread_id, reservedTurn.id);
  } catch (error) {
    return toRouteError(error);
  }

  const userMessage = createTextMessage({
    id: `${reservedTurn.id}:user`,
    role: "user",
    text,
    metadata: {
      createdAt: reservedTurn.created_at,
      turnId: reservedTurn.id,
      branchId,
    },
  });

  let turnSettled = false;
  const result = streamText({
    model: createLanguageModel(runtime.connection, runtime.threadView.thread.model_id),
    system: buildRoleplaySystemPrompt({
      character: runtime.character,
      persona: runtime.persona,
      snapshot: runtime.threadView.headSnapshot,
      pins: runtime.threadView.pins,
      timeline: [...runtime.threadView.timeline].reverse(),
    }),
    messages: await convertToModelMessages([
      ...runtime.threadView.modelContextMessages,
      userMessage,
    ]),
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

  scheduleTaskDrain("chat-turn-commit");

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
