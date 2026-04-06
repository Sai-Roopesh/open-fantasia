import { getCurrentUser } from "@/lib/auth";
import { updateBranchHead } from "@/lib/data/branches";
import { getThreadGraphView } from "@/lib/data/threads";

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

  await updateBranchHead(
    context.supabase,
    threadView.activeBranch.id,
    selected.parent_checkpoint_id,
  );

  return Response.json({
    ok: true,
    branchId: threadView.activeBranch.id,
    headCheckpointId: selected.parent_checkpoint_id,
  });
}
