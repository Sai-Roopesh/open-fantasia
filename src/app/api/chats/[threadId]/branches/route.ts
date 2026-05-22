import { getCurrentUser } from "@/lib/auth";
import { createBranchFromTurn } from "@/lib/data/branches";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { getThreadGraphView } from "@/lib/threads/read-model";
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

  const sourceTurn = threadView.turns.find(
    (turn) => turn.id === parsedBody.data.sourceTurnId,
  );
  if (!sourceTurn) {
    return Response.json(
      { error: "Branches can only be created from a visible turn on the active path." },
      { status: 404 },
    );
  }

  const branch = await createBranchFromTurn(context.supabase, {
    sourceBranchId: threadView.activeBranch.id,
    sourceTurnId: sourceTurn.id,
    name: parsedBody.data.name,
    makeActive: parsedBody.data.makeActive,
  });

  await insertTimelineEvent(context.supabase, {
    thread_id: threadId,
    branch_id: branch.id,
    turn_id: sourceTurn.id,
    title: "Branch created",
    detail: `Created ${branch.name} from this turn.`,
    importance: 2,
  });

  return Response.json({ ok: true, branchId: branch.id, branchName: branch.name });
}
