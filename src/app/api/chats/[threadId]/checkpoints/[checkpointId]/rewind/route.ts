import { getCurrentUser } from "@/lib/auth";
import { getThreadGraphView } from "@/lib/threads/read-model";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ threadId: string; checkpointId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId, checkpointId } = await params;
  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const selected = threadView.checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
  if (!selected) {
    return Response.json({ error: "Checkpoint not found on the active branch." }, { status: 404 });
  }

  const { error } = await context.supabase.rpc("rewind_thread_to_checkpoint", {
    p_thread_id: threadId,
    p_user_id: context.user.id,
    p_branch_id: threadView.activeBranch.id,
    p_checkpoint_id: selected.id,
  });

  if (error) {
    return Response.json(
      { error: error.message || "Thread rewind failed." },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    branchId: threadView.activeBranch.id,
    headCheckpointId: selected.id,
  });
}
