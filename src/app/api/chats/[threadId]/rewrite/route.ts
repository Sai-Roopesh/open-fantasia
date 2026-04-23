import { getTextFromMessage } from "@/lib/ai/message-text";
import { getCurrentUser } from "@/lib/auth";
import {
  assertLatestTurnRewriteTarget,
  assertThreadReadyForLatestRewrite,
  buildGenerationMessages,
  generateAssistantReply,
  loadThreadGenerationRuntime,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/thread-generation-service";
import { materializeSnapshotForTurn } from "@/lib/ai/continuity";
import { getSnapshot } from "@/lib/data/snapshots";
import { beginTurn, commitTurn, failTurn } from "@/lib/data/turns";
import { buildRecentSceneMessages, createTextMessage } from "@/lib/threads/read-model";
import { getValidationErrorMessage, rewriteLatestTurnRequestSchema } from "@/lib/validation";

function getLatestTurnRewriteFailureMessage(mode: "user" | "assistant" | "regenerate") {
  if (mode === "assistant") {
    return "An unknown error occurred while rewriting the latest reply.";
  }

  if (mode === "regenerate") {
    return "An unknown error occurred while regenerating the latest turn.";
  }

  return "An unknown error occurred while rewriting the latest turn.";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const parsedBody = rewriteLatestTurnRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json(
      {
        error: getValidationErrorMessage(
          parsedBody.error,
          "Fantasia needs the active branch and latest head to rewrite this turn.",
        ),
      },
      { status: 400 },
    );
  }

  let runtime: Awaited<ReturnType<typeof loadThreadGenerationRuntime>>;
  try {
    runtime = await loadThreadGenerationRuntime({
      supabase: context.supabase,
      userId: context.user.id,
      threadId,
    });
    assertThreadReadyForLatestRewrite(runtime.threadView);
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  let latestTurn: ReturnType<typeof assertLatestTurnRewriteTarget>;
  try {
    latestTurn = assertLatestTurnRewriteTarget({
      threadView: runtime.threadView,
      branchId: parsedBody.data.branchId,
      expectedHeadTurnId: parsedBody.data.expectedHeadTurnId,
    });
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  const preservedUserPayload = Array.isArray(latestTurn.user_input_payload)
    ? latestTurn.user_input_payload
    : undefined;
  const userText =
    parsedBody.data.mode === "user" ? parsedBody.data.text : latestTurn.user_input_text;

  let reservedTurn: Awaited<ReturnType<typeof beginTurn>> | undefined;
  try {
    reservedTurn = await beginTurn(context.supabase, {
      branchId: parsedBody.data.branchId,
      expectedHeadTurnId: parsedBody.data.expectedHeadTurnId,
      text: userText,
      payload: parsedBody.data.mode === "user" ? undefined : preservedUserPayload,
      parentTurnIdOverride: latestTurn.parent_turn_id,
      forceParentOverride: true,
      hiddenFromTranscript: latestTurn.user_input_hidden,
      starterSeed: latestTurn.starter_seed,
    });

    if (parsedBody.data.mode === "assistant") {
      await commitTurn(context.supabase, {
        branchId: parsedBody.data.branchId,
        turnId: reservedTurn.id,
        assistantText: parsedBody.data.text,
        provider: null,
        model: null,
        connectionLabel: null,
        finishReason: "edited",
        totalTokens: null,
        promptTokens: null,
        completionTokens: null,
      });
    } else {
      const contextTurns = runtime.threadView.turns.slice(0, -1);
      const rewrittenUserMessage = createTextMessage({
        role: "user",
        text: userText,
        metadata: {
          turnId: reservedTurn.id,
          branchId: parsedBody.data.branchId,
          hiddenFromTranscript: latestTurn.user_input_hidden,
          starterSeed: latestTurn.starter_seed,
        },
      });
      const previousSnapshot = latestTurn.parent_turn_id
        ? await getSnapshot(context.supabase, context.user.id, latestTurn.parent_turn_id)
        : null;

      const { assistantMessage, result } = await generateAssistantReply({
        runtime,
        messages: buildGenerationMessages({
          recentSceneMessages: buildRecentSceneMessages(contextTurns),
          pendingMessages: [rewrittenUserMessage],
        }),
        snapshot: previousSnapshot,
      });

      await commitTurn(context.supabase, {
        branchId: parsedBody.data.branchId,
        turnId: reservedTurn.id,
        assistantText: getTextFromMessage(assistantMessage),
        provider: runtime.connection.provider,
        model: runtime.threadView.thread.model_id,
        connectionLabel: runtime.connection.label,
        finishReason: assistantMessage.metadata?.finishReason ?? null,
        totalTokens: result.usage.totalTokens ?? null,
        promptTokens: result.usage.inputTokens ?? null,
        completionTokens: result.usage.outputTokens ?? null,
      });
    }

    await materializeSnapshotForTurn({
      supabase: context.supabase,
      userId: context.user.id,
      threadId,
      turnId: reservedTurn.id,
      connection: runtime.connection,
      modelId: runtime.threadView.thread.model_id,
      character: runtime.character,
    });

    return Response.json({ ok: true, turnId: reservedTurn.id });
  } catch (error) {
    if (reservedTurn) {
      await failTurn(context.supabase, {
        branchId: parsedBody.data.branchId,
        turnId: reservedTurn.id,
        failureCode: "LATEST_TURN_REWRITE_FAILED",
        failureMessage:
          error instanceof Error
            ? error.message
            : getLatestTurnRewriteFailureMessage(parsedBody.data.mode),
      });
    }

    return toThreadGenerationErrorResponse(error);
  }
}
