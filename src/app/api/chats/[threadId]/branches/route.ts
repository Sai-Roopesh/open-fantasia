import { getCurrentUser } from "@/lib/auth";
import { createBranch } from "@/lib/data/branches";
import { getThreadGraphView, switchActiveBranch } from "@/lib/data/threads";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { createBranchRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const parsedBody = createBranchRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "Invalid branch payload." }, { status: 400 });
  }

  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const baseCheckpoint =
    threadView.checkpoints.find(
      (checkpoint) => checkpoint.id === parsedBody.data.checkpointId,
    ) ?? threadView.latestCheckpoint;

  const branch = await createBranch(context.supabase, {
    threadId,
    name: parsedBody.data.name,
    createdBy: context.user.id,
    parentBranchId: threadView.activeBranch.id,
    forkCheckpointId: baseCheckpoint?.id ?? null,
    headCheckpointId: baseCheckpoint?.id ?? null,
  });

  if (parsedBody.data.makeActive) {
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
