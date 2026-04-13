import type { ThreadStateSnapshot } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";
import {
  castRecord,
  castRows,
  type DatabaseClient,
} from "@/lib/data/shared";

const snapshotSelect = [
  "checkpoint_id",
  "thread_id",
  "branch_id",
  "based_on_snapshot_id",
  "scenario_state",
  "relationship_state",
  "rolling_summary",
  "user_facts",
  "open_loops",
  "resolved_loops",
  "narrative_hooks",
  "scene_goals",
  "version",
  "updated_at",
].join(", ");

function normalizeSnapshot(data: Record<string, unknown>) {
  return {
    ...(data as ThreadStateSnapshot),
    user_facts: Array.isArray(data.user_facts) ? (data.user_facts as string[]) : [],
    open_loops: Array.isArray(data.open_loops) ? (data.open_loops as string[]) : [],
    resolved_loops: Array.isArray(data.resolved_loops) ? (data.resolved_loops as string[]) : [],
    narrative_hooks: Array.isArray(data.narrative_hooks) ? (data.narrative_hooks as string[]) : [],
    scene_goals: Array.isArray(data.scene_goals) ? (data.scene_goals as string[]) : [],
  } satisfies ThreadStateSnapshot;
}

export async function getSnapshot(
  supabase: DatabaseClient,
  checkpointId: string,
) {
  const { data, error } = await supabase
    .from("chat_state_snapshots")
    .select(snapshotSelect)
    .eq("checkpoint_id", checkpointId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeSnapshot(castRecord(data)) : null;
}

export async function listSnapshots(
  supabase: DatabaseClient,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_state_snapshots")
    .select(snapshotSelect)
    .eq("thread_id", threadId);

  if (error) throw error;
  return castRows<unknown>(data).map((snapshot) =>
    normalizeSnapshot(castRecord(snapshot)),
  );
}

export async function listSnapshotsByCheckpointIds(
  supabase: DatabaseClient,
  checkpointIds: string[],
) {
  if (!checkpointIds.length) return [];

  const { data, error } = await supabase
    .from("chat_state_snapshots")
    .select(snapshotSelect)
    .in("checkpoint_id", checkpointIds);

  if (error) throw error;
  return castRows<unknown>(data).map((snapshot) =>
    normalizeSnapshot(castRecord(snapshot)),
  );
}

export async function saveSnapshot(
  supabase: DatabaseClient,
  snapshot: ThreadStateSnapshot,
) {
  const { error } = await supabase.from("chat_state_snapshots").upsert({
    checkpoint_id: snapshot.checkpoint_id,
    thread_id: snapshot.thread_id,
    branch_id: snapshot.branch_id,
    based_on_snapshot_id: snapshot.based_on_snapshot_id,
    scenario_state: snapshot.scenario_state,
    relationship_state: snapshot.relationship_state,
    rolling_summary: snapshot.rolling_summary,
    user_facts: snapshot.user_facts as Json,
    open_loops: snapshot.open_loops as Json,
    resolved_loops: snapshot.resolved_loops as Json,
    narrative_hooks: snapshot.narrative_hooks as Json,
    scene_goals: snapshot.scene_goals as Json,
    version: snapshot.version,
    updated_at: snapshot.updated_at,
  });

  if (error) throw error;
}
