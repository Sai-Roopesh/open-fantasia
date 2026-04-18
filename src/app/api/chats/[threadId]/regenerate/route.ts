import { getTextFromMessage } from "@/lib/ai/message-text";
import { getCurrentUser } from "@/lib/auth";
import {
  assertThreadReadyForLatestRewrite,
  generateAssistantReply,
  loadThreadGenerationRuntime,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/thread-generation-service";
import { getSnapshot } from "@/lib/data/snapshots";
import { beginTurn, commitTurn, failTurn } from "@/lib/data/turns";
import { scheduleTaskDrain } from "@/lib/jobs/schedule-task-drain";
import { createTextMessage } from "@/lib/threads/read-model";
import { regenerateTurnRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const parsedBody = regenerateTurnRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "Fantasia needs the latest head to regenerate." }, { status: 400 });
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

  const latestTurn = runtime.threadView.latestTurn;
  if (!latestTurn || latestTurn.id !== parsedBody.data.expectedHeadTurnId) {
    return Response.json(
      { error: "The branch head changed before Fantasia could regenerate the latest turn." },
      { status: 409 },
    );
  }

  const previousMessages = runtime.threadView.turns
    .slice(0, -1)
    .flatMap((turn) => runtime.threadView.modelContextMessages.filter((message) =>
      message.metadata?.turnId === turn.id,
    ));
  const regeneratedUserMessage = createTextMessage({
    role: "user",
    text: latestTurn.user_input_text,
    metadata: {
      turnId: latestTurn.id,
      branchId: parsedBody.data.branchId,
      hiddenFromTranscript: latestTurn.user_input_hidden,
      starterSeed: latestTurn.starter_seed,
    },
  });

  let reservedTurn: Awaited<ReturnType<typeof beginTurn>> | undefined;
  try {
    reservedTurn = await beginTurn(context.supabase, {
      branchId: parsedBody.data.branchId,
      expectedHeadTurnId: parsedBody.data.expectedHeadTurnId,
      text: latestTurn.user_input_text,
      parentTurnIdOverride: latestTurn.parent_turn_id,
      forceParentOverride: true,
      hiddenFromTranscript: latestTurn.user_input_hidden,
      starterSeed: latestTurn.starter_seed,
    });

    const previousSnapshot = latestTurn.parent_turn_id
      ? await getSnapshot(context.supabase, context.user.id, latestTurn.parent_turn_id)
      : null;

    const { assistantMessage, result } = await generateAssistantReply({
      runtime,
      messages: [...previousMessages, regeneratedUserMessage],
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

    scheduleTaskDrain("regenerate-turn-commit");

    return Response.json({ ok: true, turnId: reservedTurn.id });
  } catch (error) {
    if (reservedTurn) {
      await failTurn(context.supabase, {
        branchId: parsedBody.data.branchId,
        turnId: reservedTurn.id,
        failureCode: "GENERATION_FAILED",
        failureMessage:
          error instanceof Error ? error.message : "An unknown error occurred during regeneration.",
      });
    }
    return toThreadGenerationErrorResponse(error);
  }
}
