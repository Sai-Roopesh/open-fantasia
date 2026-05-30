import { listConnections } from "@/lib/data/connections";
import type { DatabaseClient } from "@/lib/data/shared";
import { buildTurnSlicePatch } from "@/lib/domain/slice-projections";
import { loadThreadAssemblyWithSnapshot } from "@/lib/services/thread-reader";
import type { MutationResult, TurnSlicePatch } from "@/lib/types";

/**
 * Build the authoritative TurnSlicePatch after any mutation.
 * Returns null if the thread is not found.
 */
export async function buildSlicePatch(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
): Promise<TurnSlicePatch | null> {
  const [assembled, connections] = await Promise.all([
    loadThreadAssemblyWithSnapshot(supabase, userId, threadId),
    listConnections(supabase, userId),
  ]);

  if (!assembled) return null;
  return buildTurnSlicePatch(assembled.assembly, assembled.snapshot, connections);
}

/**
 * Build the authoritative slice response for API routes (read-your-writes).
 * Returns a JSON Response with { ok: true, slice } or { ok: false, error }.
 */
export async function buildSliceResponse(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
): Promise<Response> {
  const patch = await buildSlicePatch(supabase, userId, threadId);

  if (!patch) {
    return Response.json(
      { ok: false, error: "Thread not found." } satisfies MutationResult,
      { status: 404 },
    );
  }

  return Response.json({ ok: true, slice: patch } satisfies MutationResult);
}
