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
  if (!threadView || !threadView.latestCheckpoint) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const selected = threadView.checkpoints.find((checkpoint) => checkpoint.id === checkpointId)
    ?? (await context.supabase
      .from("chat_checkpoints")
      .select("id, choice_group_key, branch_id")
      .eq("id", checkpointId)
      .eq("branch_id", threadView.activeBranch.id)
      .maybeSingle()).data;

  if (!selected) {
    return Response.json({ error: "Checkpoint not found." }, { status: 404 });
  }

  if (selected.choice_group_key !== threadView.latestCheckpoint.choice_group_key) {
    return Response.json(
      { error: "Only alternates for the latest assistant turn can be selected." },
      { status: 400 },
    );
  }

  await updateBranchHead(context.supabase, threadView.activeBranch.id, checkpointId);
  return Response.json({ ok: true });
}
