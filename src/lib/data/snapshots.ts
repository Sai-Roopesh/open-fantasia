import type { Json } from "@/lib/supabase/database.types";
import type { ThreadStateSnapshot } from "@/lib/types";
import {
  parseRow,
  parseRows,
  type DatabaseClient,
} from "@/lib/data/shared";
import { snapshotRecordSchema } from "@/lib/validation";

const snapshotSelect = [
  "turn_id",
  "thread_id",
  "branch_id",
  "based_on_turn_id",
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

export async function getSnapshot(
  supabase: DatabaseClient,
  userId: string,
  turnId: string,
) {
  const { data, error } = await supabase
    .from("chat_turn_snapshots")
    .select(snapshotSelect)
    .eq("turn_id", turnId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? (parseRow(data, snapshotRecordSchema, "Snapshot") as ThreadStateSnapshot)
    : null;
}

export async function listSnapshots(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_turn_snapshots")
    .select(snapshotSelect)
    .eq("thread_id", threadId);

  if (error) {
    throw error;
  }

  return parseRows(
    data ?? [],
    snapshotRecordSchema,
    "Thread snapshots",
  ) as ThreadStateSnapshot[];
}

export async function saveSnapshot(
  supabase: DatabaseClient,
  snapshot: ThreadStateSnapshot,
) {
  const { error } = await supabase.from("chat_turn_snapshots").upsert({
    turn_id: snapshot.turn_id,
    thread_id: snapshot.thread_id,
    branch_id: snapshot.branch_id,
    based_on_turn_id: snapshot.based_on_turn_id,
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

  if (error) {
    throw error;
  }
}
