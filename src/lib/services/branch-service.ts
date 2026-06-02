import { createBranchFromTurn } from "@/lib/data/branches";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { switchActiveBranch } from "@/lib/data/threads";
import type { DatabaseClient } from "@/lib/data/shared";
import { loadThreadAssembly } from "@/lib/services/thread-reader";
import { buildSlicePatch, buildSliceResponse } from "@/lib/services/slice-service";
import type { MutationResult } from "@/lib/types";

/**
 * Forks a new branch from a visible turn. No world-state copy is needed:
 * snapshots are keyed by turn_id and the new branch shares all ancestor turns,
 * so it transparently reads the shared ancestor snapshot and only writes fresh
 * snapshots for its own divergent turns.
 */
export async function createBranch(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; sourceTurnId: string; name: string; makeActive?: boolean },
): Promise<Response> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const sourceTurn = assembly.turns.find((turn) => turn.id === args.sourceTurnId);
  if (!sourceTurn) {
    return Response.json(
      { error: "Branches can only be created from a visible turn on the active path." },
      { status: 404 },
    );
  }

  const branch = await createBranchFromTurn(supabase, {
    userId,
    sourceBranchId: assembly.activeBranch.id,
    sourceTurnId: sourceTurn.id,
    name: args.name,
    makeActive: args.makeActive,
  });

  await insertTimelineEvent(supabase, {
    thread_id: args.threadId,
    branch_id: branch.id,
    turn_id: sourceTurn.id,
    title: "Branch created",
    detail: `Created ${branch.name} from this turn.`,
    importance: 2,
    event_type: "scene_change",
    affected_entity_ids: [],
    affected_relationship_ids: [],
  });

  return buildSliceResponse(supabase, userId, args.threadId);
}

/**
 * Activates a different branch and records a timeline beat so the switch is
 * visible in the continuity inspector's audit trail.
 */
export async function switchBranch(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; branchId: string },
): Promise<MutationResult> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) return { ok: false, error: "Thread not found." };

  const target = assembly.branches.find((b) => b.id === args.branchId);
  if (!target) return { ok: false, error: "Branch not found." };

  await switchActiveBranch(supabase, userId, args);
  await insertTimelineEvent(supabase, {
    thread_id: args.threadId,
    branch_id: args.branchId,
    turn_id: target.head_turn_id,
    title: "Branch switched",
    detail: `Switched the active branch to ${target.name}.`,
    importance: 2,
    event_type: "scene_change",
    affected_entity_ids: [],
    affected_relationship_ids: [],
  });

  const patch = await buildSlicePatch(supabase, userId, args.threadId);
  if (!patch) return { ok: false, error: "Thread not found." };
  return { ok: true, slice: patch };
}
