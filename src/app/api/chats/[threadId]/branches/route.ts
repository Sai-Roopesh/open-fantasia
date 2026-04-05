import { getCurrentUser } from "@/lib/auth";
import {
  createBranch,
  getThreadGraphView,
  insertTimelineEvent,
  switchActiveBranch,
} from "@/lib/data/threads";

type BranchRequest = {
  checkpointId?: string;
  name?: string;
  makeActive?: boolean;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const body = (await request.json()) as BranchRequest;
  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const baseCheckpoint =
    body.checkpointId
      ? threadView.checkpoints.find((checkpoint) => checkpoint.id === body.checkpointId)
      : threadView.latestCheckpoint;

  const branchCount = threadView.branches.length + 1;
  const branch = await createBranch(context.supabase, {
    threadId,
    name: body.name?.trim() || `branch-${branchCount}`,
    createdBy: context.user.id,
    parentBranchId: threadView.activeBranch.id,
    forkCheckpointId: baseCheckpoint?.id ?? null,
    headCheckpointId: baseCheckpoint?.id ?? null,
  });

  if (body.makeActive ?? true) {
    await switchActiveBranch(context.supabase, context.user.id, {
      threadId,
      branchId: branch.id,
    });
  }

  await insertTimelineEvent(context.supabase, {
    thread_id: threadId,
    branch_id: branch.id,
    checkpoint_id: baseCheckpoint?.id ?? null,
    source_message_id: baseCheckpoint?.assistant_message_id ?? null,
    title: "Branch created",
    detail: `Created ${branch.name}${baseCheckpoint ? " from this checkpoint" : ""}.`,
    importance: 2,
  });

  return Response.json({ ok: true, branchId: branch.id, branchName: branch.name });
}
