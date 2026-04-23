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
  "story_summary",
  "scene_summary",
  "last_turn_beat",
  "relationship_state",
  "user_facts",
  "active_threads",
  "resolved_threads",
  "next_turn_pressure",
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
    story_summary: snapshot.story_summary,
    scene_summary: snapshot.scene_summary,
    last_turn_beat: snapshot.last_turn_beat,
    relationship_state: snapshot.relationship_state,
    user_facts: snapshot.user_facts as Json,
    active_threads: snapshot.active_threads as Json,
    resolved_threads: snapshot.resolved_threads as Json,
    next_turn_pressure: snapshot.next_turn_pressure as Json,
    scene_goals: snapshot.scene_goals as Json,
    version: snapshot.version,
    updated_at: snapshot.updated_at,
  });

  if (error) {
    throw error;
  }
}
