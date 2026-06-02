import { rewindBranchToTurn } from "@/lib/data/branches";
import type { DatabaseClient } from "@/lib/data/shared";
import { loadThreadAssembly } from "@/lib/services/thread-reader";
import { buildSliceResponse } from "@/lib/services/slice-service";

/**
 * Rewinds the active branch to a reachable turn, discarding the descendant
 * subtree (and, via cascade, the discarded turns' snapshots and any sibling
 * branches rooted in the pruned subtree).
 *
 * No HCE re-materialization is performed: the target turn already owns the
 * snapshot it produced when it was first committed, and that snapshot is exactly
 * the state to restore. Re-extracting would wrongly re-derive it. The slice
 * reload surfaces the restored snapshot.
 */
export async function rewindToTurn(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; turnId: string },
): Promise<Response> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  if (!assembly.turns.some((turn) => turn.id === args.turnId)) {
    return Response.json({ error: "Turn not found on the active branch." }, { status: 404 });
  }

  await rewindBranchToTurn(supabase, {
    userId,
    branchId: assembly.activeBranch.id,
    targetTurnId: args.turnId,
    expectedHeadTurnId: assembly.activeBranch.head_turn_id,
  });

  return buildSliceResponse(supabase, userId, args.threadId);
}
