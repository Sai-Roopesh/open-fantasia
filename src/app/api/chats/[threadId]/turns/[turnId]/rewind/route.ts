import { getCurrentUser } from "@/lib/auth";
import { rewindBranchToTurn } from "@/lib/data/branches";
import { getThreadGraphView } from "@/lib/threads/read-model";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ threadId: string; turnId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId, turnId } = await params;
  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  if (!threadView.turns.some((turn) => turn.id === turnId)) {
    return Response.json({ error: "Turn not found on the active branch." }, { status: 404 });
  }

  await rewindBranchToTurn(context.supabase, {
    branchId: threadView.activeBranch.id,
    targetTurnId: turnId,
    expectedHeadTurnId: threadView.activeBranch.head_turn_id,
  });

  return Response.json({ ok: true });
}
