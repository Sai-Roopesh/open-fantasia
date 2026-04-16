import { getCurrentUser } from "@/lib/auth";
import {
  assertThreadReadyForGeneration,
  generateAssistantReply,
  loadThreadGenerationRuntime,
  toThreadGenerationErrorResponse,
} from "@/lib/ai/thread-generation-service";
import {
  reconcileCheckpointInBand,
  rewriteCheckpointTurnInPlace,
} from "@/lib/ai/turn-finalizer";
import { getSnapshot } from "@/lib/data/snapshots";
import { regenerateRequestSchema } from "@/lib/validation";

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
  const parsedBody = regenerateRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "Invalid regenerate payload." }, { status: 400 });
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
  if (
    parsedBody.data.checkpointId &&
    parsedBody.data.checkpointId !== latestCheckpoint.id
  ) {
    return Response.json(
      { error: "Only the latest assistant checkpoint can be regenerated." },
      { status: 400 },
    );
  }

  const contextMessages = runtime.threadView.modelContextMessages.slice(0, -1);
  const priorSnapshot = latestCheckpoint.parent_checkpoint_id
    ? await getSnapshot(supabase, user.id, latestCheckpoint.parent_checkpoint_id)
    : null;

  const { assistantMessage } = await generateAssistantReply({
    runtime,
    messages: contextMessages,
    snapshot: priorSnapshot,
    assistantMessageId: latestCheckpoint.assistant_message_id,
  });

  const { checkpoint, reconcilePayload } = await rewriteCheckpointTurnInPlace({
    supabase,
    userId: user.id,
    thread: runtime.threadView.thread,
    branchId: runtime.threadView.activeBranch.id,
    checkpoint: latestCheckpoint,
    assistantMessage,
    recentMessages: [...contextMessages, assistantMessage],
  });
  await reconcileCheckpointInBand({
    supabase,
    userId: user.id,
    payload: reconcilePayload,
  });

  return Response.json({ ok: true, checkpointId: checkpoint.id });
}
