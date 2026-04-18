import { getTextFromMessage } from "@/lib/ai/message-text";
import { getCurrentUser } from "@/lib/auth";
import {
  generateAssistantReply,
  loadThreadGenerationRuntime,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/thread-generation-service";
import { materializeSnapshotForTurn } from "@/lib/ai/continuity";
import { beginTurn, commitTurn, failTurn } from "@/lib/data/turns";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { createTextMessage } from "@/lib/threads/read-model";
import { starterSeedRequestSchema } from "@/lib/validation";

function buildStarterSeedPrompt(starter: string) {
  return [
    "Use this as hidden scene guidance for your very first reply in the thread.",
    "This is not literal user dialogue, and it should not appear verbatim in the transcript unless you naturally adapt parts of it.",
    "Open the scene in character, establish the moment vividly, and leave room for the user to answer next.",
    "",
    `Starter seed: ${starter}`,
  ].join("\n");
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
  const parsedBody = starterSeedRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return Response.json({ error: "A starter seed is required." }, { status: 400 });
  }

  let runtime: Awaited<ReturnType<typeof loadThreadGenerationRuntime>>;
  try {
    runtime = await loadThreadGenerationRuntime({
      supabase: context.supabase,
      userId: context.user.id,
      threadId,
    });
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  if (runtime.threadView.turns.length > 0) {
    return Response.json(
      { error: "Starter openings can only be used before the first turn." },
      { status: 400 },
    );
  }

  const starterText = buildStarterSeedPrompt(parsedBody.data.starter);
  let reservedTurn: Awaited<ReturnType<typeof beginTurn>> | undefined;
  try {
    reservedTurn = await beginTurn(context.supabase, {
      branchId: runtime.threadView.activeBranch.id,
      expectedHeadTurnId: runtime.threadView.activeBranch.head_turn_id,
      text: starterText,
      hiddenFromTranscript: true,
      starterSeed: true,
    });

    const starterMessage = createTextMessage({
      role: "user",
      text: starterText,
      metadata: {
        hiddenFromTranscript: true,
        starterSeed: true,
        turnId: reservedTurn.id,
        branchId: runtime.threadView.activeBranch.id,
      },
    });

    const { assistantMessage, result } = await generateAssistantReply({
      runtime,
      messages: [...runtime.threadView.modelContextMessages, starterMessage],
      snapshot: runtime.threadView.headSnapshot,
    });

    await commitTurn(context.supabase, {
      branchId: runtime.threadView.activeBranch.id,
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

    await insertTimelineEvent(context.supabase, {
      thread_id: threadId,
      branch_id: runtime.threadView.activeBranch.id,
      turn_id: reservedTurn.id,
      title: "Starter opening generated",
      detail: "Opened the scene from a seeded first-turn prompt.",
      importance: 2,
    });
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
        branchId: runtime.threadView.activeBranch.id,
        turnId: reservedTurn.id,
        failureCode: "GENERATION_FAILED",
        failureMessage:
          error instanceof Error ? error.message : "An unknown error occurred during generation.",
      });
    }
    return toThreadGenerationErrorResponse(error);
  }
}
