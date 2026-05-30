import { z } from "zod";
import { getCharacterBundle } from "@/lib/data/characters";
import { parseRow, type DatabaseClient } from "@/lib/data/shared";
import { getThread } from "@/lib/data/threads";
import { listBranches } from "@/lib/data/branches";
import { listTurnsForThread } from "@/lib/data/turns";
import { listWorldSnapshots } from "@/lib/data/world-state";
import { materializeDurableSnapshot } from "@/lib/ai/state-materializer";
import {
  buildThreadAssembly,
  type ThreadAssembly,
} from "@/lib/domain/thread-assembly";
import type {
  ChatPinRecord,
  SnapshotResolution,
  TimelineEventRecord,
  WorldSnapshotRecord,
} from "@/lib/types";

const timelineRecordSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  turn_id: z.string().uuid().nullable(),
  title: z.string(),
  detail: z.string(),
  importance: z.number().int(),
  event_type: z.string(),
  affected_entity_ids: z.array(z.string()).default([]),
  affected_relationship_ids: z.array(z.string()).default([]),
  created_at: z.string(),
});

const pinRecordSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  turn_id: z.string().uuid().nullable(),
  body: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

async function listTimeline(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<TimelineEventRecord[]> {
  const { data, error } = await supabase
    .from("chat_timeline_events")
    .select(
      "id, thread_id, branch_id, turn_id, title, detail, importance, event_type, affected_entity_ids, affected_relationship_ids, created_at",
    )
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) =>
    parseRow(row, timelineRecordSchema, "Timeline event"),
  ) as TimelineEventRecord[];
}

async function listPins(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<ChatPinRecord[]> {
  const { data, error } = await supabase
    .from("chat_pins")
    .select("id, thread_id, branch_id, turn_id, body, status, created_at, updated_at")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) =>
    parseRow(row, pinRecordSchema, "Pin"),
  ) as ChatPinRecord[];
}

async function resolveSnapshotForAssembly(
  supabase: DatabaseClient,
  assembly: ThreadAssembly,
  snapshotRecords: WorldSnapshotRecord[],
): Promise<SnapshotResolution> {
  const { thread, activeBranch, turns, latestTurn } = assembly;

  const snapshotsByTurnId = new Map(snapshotRecords.map((s) => [s.turn_id, s]));

  const latestSnapshotRecord =
    [...turns]
      .reverse()
      .map((turn) => snapshotsByTurnId.get(turn.id) ?? null)
      .find((s) => s !== null) ?? null;

  const headSnapshotRecord = latestTurn
    ? (snapshotsByTurnId.get(latestTurn.id) ?? latestSnapshotRecord)
    : latestSnapshotRecord;

  if (!headSnapshotRecord) {
    return { snapshot: null, isPending: false, isFailed: false, failureMessage: null };
  }

  try {
    const snapshot = await materializeDurableSnapshot(
      supabase,
      thread.id,
      activeBranch.id,
      headSnapshotRecord.turn_id,
      headSnapshotRecord,
    );
    return { snapshot, isPending: false, isFailed: false, failureMessage: null };
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : String(error);
    console.error("[thread-reader] Failed to materialize durable snapshot.", {
      threadId: thread.id,
      turnId: headSnapshotRecord.turn_id,
      error: failureMessage,
    });
    return { snapshot: null, isPending: false, isFailed: true, failureMessage };
  }
}

/**
 * Load the thread assembly without resolving the snapshot.
 * Used by mutations that don't need the snapshot: rate, rewind, pin, settings.
 */
export async function loadThreadAssembly(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
): Promise<ThreadAssembly | null> {
  const thread = await getThread(supabase, userId, threadId);
  if (!thread) return null;

  const [branches, turns, characterBundle] = await Promise.all([
    listBranches(supabase, thread.id),
    listTurnsForThread(supabase, thread.id),
    getCharacterBundle(supabase, userId, thread.character_id),
  ]);

  const activeBranch = branches.find((b) => b.is_active) ?? branches[0] ?? null;
  if (!activeBranch) return null;

  const [timelineRows, pinRows] = await Promise.all([
    listTimeline(supabase, thread.id, activeBranch.id),
    listPins(supabase, thread.id, activeBranch.id),
  ]);

  try {
    return buildThreadAssembly({
      thread,
      branches,
      turns,
      characterBundle,
      timelineRows,
      pinRows,
    });
  } catch {
    return null;
  }
}

/**
 * Load the thread assembly and resolve the head snapshot.
 * Used by generation, page renders, and the continuity polling slice.
 */
export async function loadThreadAssemblyWithSnapshot(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
): Promise<{ assembly: ThreadAssembly; snapshot: SnapshotResolution } | null> {
  const thread = await getThread(supabase, userId, threadId);
  if (!thread) return null;

  const [branches, turns, characterBundle] = await Promise.all([
    listBranches(supabase, thread.id),
    listTurnsForThread(supabase, thread.id),
    getCharacterBundle(supabase, userId, thread.character_id),
  ]);

  const activeBranch = branches.find((b) => b.is_active) ?? branches[0] ?? null;
  if (!activeBranch) return null;

  const [snapshotRecords, timelineRows, pinRows] = await Promise.all([
    listWorldSnapshots(supabase, thread.id),
    listTimeline(supabase, thread.id, activeBranch.id),
    listPins(supabase, thread.id, activeBranch.id),
  ]);

  let assembly: ThreadAssembly;
  try {
    assembly = buildThreadAssembly({
      thread,
      branches,
      turns,
      characterBundle,
      timelineRows,
      pinRows,
    });
  } catch {
    return null;
  }

  const snapshot = await resolveSnapshotForAssembly(supabase, assembly, snapshotRecords ?? []);
  return { assembly, snapshot };
}
