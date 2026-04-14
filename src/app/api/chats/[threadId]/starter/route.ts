import { getCurrentUser } from "@/lib/auth";
import {
  generateAssistantReply,
  loadThreadGenerationRuntime,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/thread-generation-service";
import {
  finalizeAssistantTurn,
  reconcileCheckpointInBand,
} from "@/lib/ai/turn-finalizer";
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

  const supabase = context.supabase;
  const user = context.user;
  const { threadId } = await params;
  const parsedBody = starterSeedRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return Response.json({ error: "A starter seed is required." }, { status: 400 });
  }

  let runtime: Awaited<ReturnType<typeof loadThreadGenerationRuntime>>;
  try {
    runtime = await loadThreadGenerationRuntime({
      supabase,
      userId: user.id,
      threadId,
    });
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  if (runtime.threadView.checkpoints.length > 0) {
    return Response.json(
      { error: "Starter openings can only be used before the first turn." },
      { status: 400 },
    );
  }

  const starterMessage = createTextMessage({
    role: "user",
    text: buildStarterSeedPrompt(parsedBody.data.starter),
    metadata: {
      hiddenFromTranscript: true,
      starterSeed: true,
    },
  });

  const { assistantMessage } = await generateAssistantReply({
    runtime,
    messages: [...runtime.threadView.modelContextMessages, starterMessage],
    snapshot: runtime.threadView.resolvedSnapshot,
  });

  const { checkpoint, reconcilePayload } = await finalizeAssistantTurn({
    supabase,
    userId: user.id,
    thread: runtime.threadView.thread,
    branchId: runtime.threadView.activeBranch.id,
    parentCheckpointId: runtime.threadView.activeBranch.head_checkpoint_id,
    userMessage: starterMessage,
    assistantMessage,
    choiceGroupKey: `choice:${crypto.randomUUID()}`,
    recentMessages: [
      ...runtime.threadView.modelContextMessages,
      starterMessage,
      assistantMessage,
    ],
  });
  await reconcileCheckpointInBand({
    supabase,
    userId: user.id,
    payload: reconcilePayload,
  });

  await insertTimelineEvent(supabase, {
    thread_id: threadId,
    branch_id: runtime.threadView.activeBranch.id,
    checkpoint_id: checkpoint.id,
    source_message_id: checkpoint.assistant_message_id,
    title: "Starter opening generated",
    detail: "Opened the scene from a seeded first-turn prompt.",
    importance: 2,
  });

  return Response.json({ ok: true, checkpointId: checkpoint.id });
}
