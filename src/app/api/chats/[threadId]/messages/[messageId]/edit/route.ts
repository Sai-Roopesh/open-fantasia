import { getCurrentUser } from "@/lib/auth";
import {
  assertThreadReadyForGeneration,
  generateAssistantReply,
  loadThreadGenerationRuntime,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/thread-generation-service";
import { rewriteCheckpointTurnInPlace } from "@/lib/ai/turn-finalizer";
import { getSnapshot } from "@/lib/data/snapshots";
import { scheduleBackgroundWorker } from "@/lib/jobs/kick-worker";
import { createTextMessage } from "@/lib/threads/read-model";
import { editMessageRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string; messageId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = context.supabase;
  const user = context.user;
  const { threadId, messageId } = await params;
  const parsedBody = editMessageRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return Response.json({ error: "Edited content is required." }, { status: 400 });
  }

  let runtime: Awaited<ReturnType<typeof loadThreadGenerationRuntime>>;
  try {
    runtime = await loadThreadGenerationRuntime({
      supabase,
      userId: user.id,
      threadId,
    });
    assertThreadReadyForGeneration(runtime.threadView);
  } catch (error) {
    return toThreadGenerationErrorResponse(error);
  }

  const latestCheckpoint = runtime.threadView.latestCheckpoint;
  if (!latestCheckpoint) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  if (latestCheckpoint.user_message_id !== messageId) {
    return Response.json(
      { error: "Only the latest user message can be edited in this build." },
      { status: 400 },
    );
  }

  const parentCheckpointId = latestCheckpoint.parent_checkpoint_id;
  const priorSnapshot = parentCheckpointId
    ? await getSnapshot(supabase, parentCheckpointId)
    : null;

  const contextMessages = runtime.threadView.modelContextMessages.slice(0, -2);
  const editedUserMessage = createTextMessage({
    id: latestCheckpoint.user_message_id,
    role: "user",
    text: parsedBody.data.content,
  });

  const { assistantMessage } = await generateAssistantReply({
    runtime,
    messages: [...contextMessages, editedUserMessage],
    snapshot: priorSnapshot,
    pins: [],
    timeline: parentCheckpointId
      ? runtime.threadView.timeline.filter((event) => event.checkpoint_id !== latestCheckpoint.id)
      : [],
    assistantMessageId: latestCheckpoint.assistant_message_id,
  });

  const { checkpoint } = await rewriteCheckpointTurnInPlace({
    supabase,
    userId: user.id,
    thread: runtime.threadView.thread,
    branchId: runtime.threadView.activeBranch.id,
    checkpoint: latestCheckpoint,
    userMessage: editedUserMessage,
    assistantMessage,
    recentMessages: [...contextMessages, editedUserMessage, assistantMessage],
  });
  scheduleBackgroundWorker(1);

  return Response.json({
    ok: true,
    branchId: runtime.threadView.activeBranch.id,
    checkpointId: checkpoint.id,
  });
}
