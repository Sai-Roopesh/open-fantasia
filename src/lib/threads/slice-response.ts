import { listConnections } from "@/lib/data/connections";
import type { DatabaseClient } from "@/lib/data/shared";
import { buildTurnSlicePatch, getThreadGraphView } from "@/lib/threads/read-model";
import type { MutationResult } from "@/lib/types";

/**
 * Rebuild the authoritative thread view after a mutation and return it as a
 * read-your-writes {@link MutationResult} slice. The client applies this slice
 * directly to its store, so the UI updates without a blind router.refresh().
 */
export async function buildSliceResponse(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
): Promise<Response> {
  const [view, connections] = await Promise.all([
    getThreadGraphView(supabase, userId, threadId),
    listConnections(supabase, userId),
  ]);

  if (!view) {
    return Response.json(
      { ok: false, error: "Thread not found." } satisfies MutationResult,
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    slice: buildTurnSlicePatch(view, connections),
  } satisfies MutationResult);
}
