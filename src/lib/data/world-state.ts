import type { DatabaseClient } from "@/lib/data/shared";
import type { DurableMemorySnapshot, WorldSnapshotRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// world_snapshots — the single source of truth for branch continuity.
// Each row stores the full DurableMemorySnapshot for one turn as JSONB.
// Snapshots are keyed by turn_id (not turn_id+branch), so branches that share
// ancestor turns transparently share those ancestor snapshots.
// ---------------------------------------------------------------------------

export async function getWorldSnapshot(
  supabase: DatabaseClient,
  turnId: string,
): Promise<WorldSnapshotRecord | null> {
  const { data, error } = await supabase
    .from("world_snapshots")
    .select("*")
    .eq("turn_id", turnId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as WorldSnapshotRecord) ?? null;
}

/**
 * Fetches snapshots for a specific set of turn ids in a single query. Used by
 * the continuity ancestor walk instead of issuing one round-trip per ancestor.
 */
export async function getWorldSnapshotsForTurns(
  supabase: DatabaseClient,
  turnIds: string[],
): Promise<WorldSnapshotRecord[]> {
  if (turnIds.length === 0) return [];
  const { data, error } = await supabase
    .from("world_snapshots")
    .select("*")
    .in("turn_id", turnIds);

  if (error) throw error;
  return (data ?? []) as unknown as WorldSnapshotRecord[];
}

export async function listWorldSnapshots(
  supabase: DatabaseClient,
  threadId: string,
): Promise<WorldSnapshotRecord[]> {
  const { data, error } = await supabase
    .from("world_snapshots")
    .select("*")
    .eq("thread_id", threadId)
    // world_snapshots is keyed by turn_id (no `id` column); use it as the stable
    // secondary sort.
    .order("created_at", { ascending: true })
    .order("turn_id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as WorldSnapshotRecord[];
}

/**
 * Atomically writes a turn's full world state via the upsert_world_snapshot
 * RPC. One round-trip, one transaction — replaces the old ~30 sequential writes.
 */
export async function saveWorldSnapshot(
  supabase: DatabaseClient,
  args: {
    turnId: string;
    threadId: string;
    branchId: string;
    basedOnTurnId: string | null;
    worldState: DurableMemorySnapshot;
    version: number;
    isFullMaterialization: boolean;
  },
): Promise<WorldSnapshotRecord> {
  const { data, error } = await supabase.rpc("upsert_world_snapshot", {
    p_turn_id: args.turnId,
    p_thread_id: args.threadId,
    p_branch_id: args.branchId,
    p_based_on_turn_id: args.basedOnTurnId,
    p_world_state: args.worldState as never,
    p_version: args.version,
    p_is_full_materialization: args.isFullMaterialization,
  });

  if (error) throw error;
  return data as unknown as WorldSnapshotRecord;
}
