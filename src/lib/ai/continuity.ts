import type { CharacterBundle } from "@/lib/data/characters";
import type { DatabaseClient } from "@/lib/data/shared";
import { getSnapshot, saveSnapshot } from "@/lib/data/snapshots";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { listTurnsForThread, toTranscriptMessages } from "@/lib/data/turns";
import { getTextFromMessage } from "@/lib/ai/message-text";
import {
  buildSnapshotFromReconciliation,
  reconcileTurnState,
} from "@/lib/ai/thread-engine";
import { buildTurnPath } from "@/lib/threads/read-model";
import type {
  ChatTurnRecord,
  ConnectionRecord,
  FantasiaUIMessage,
  ThreadStateSnapshot,
} from "@/lib/types";
import { dedupeStrings } from "@/lib/utils";

const RECENT_RECONCILIATION_TURN_WINDOW = 10;

function clipText(value: string, limit: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }

  return `${compact.slice(0, limit).trim()}...`;
}

function summarizeRecentMessages(messages: FantasiaUIMessage[]) {
  return clipText(
    messages
      .map((message) => `${message.role.toUpperCase()}: ${getTextFromMessage(message)}`)
      .filter(Boolean)
      .join(" "),
    900,
  );
}

export function buildFallbackSnapshot(args: {
  turn: ChatTurnRecord;
  previousSnapshot: ThreadStateSnapshot | null;
  recentMessages: FantasiaUIMessage[];
}) {
  const assistantText = args.turn.assistant_output_text ?? "";
  const userText = args.turn.user_input_hidden ? "" : args.turn.user_input_text;
  const recentSummary =
    summarizeRecentMessages(args.recentMessages) ||
    clipText([userText, assistantText].filter(Boolean).join(" "), 900) ||
    args.previousSnapshot?.scene_summary ||
    "The scene advanced through the latest exchange.";
  const storySummary =
    clipText(
      [args.previousSnapshot?.story_summary, recentSummary].filter(Boolean).join(" "),
      1_200,
    ) ||
    args.previousSnapshot?.story_summary ||
    "The scene advanced through the latest exchange.";
  const lastTurnBeat =
    clipText([userText, assistantText].filter(Boolean).join(" "), 280) ||
    args.previousSnapshot?.last_turn_beat ||
    "The latest exchange shifted the scene.";

  return {
    turn_id: args.turn.id,
    thread_id: args.turn.thread_id,
    branch_id: args.turn.branch_origin_id,
    based_on_turn_id: args.previousSnapshot?.turn_id ?? null,
    story_summary: storySummary,
    scene_summary: recentSummary,
    last_turn_beat: lastTurnBeat,
    relationship_state:
      args.previousSnapshot?.relationship_state ||
      "The relationship is evolving through the latest exchange.",
    user_facts: dedupeStrings(args.previousSnapshot?.user_facts ?? []).slice(0, 8),
    active_threads: dedupeStrings(args.previousSnapshot?.active_threads ?? []).slice(0, 5),
    resolved_threads: dedupeStrings(args.previousSnapshot?.resolved_threads ?? []).slice(0, 5),
    next_turn_pressure: dedupeStrings(args.previousSnapshot?.next_turn_pressure ?? []).slice(0, 3),
    scene_goals: dedupeStrings(args.previousSnapshot?.scene_goals ?? []).slice(0, 5),
    version: (args.previousSnapshot?.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  } satisfies ThreadStateSnapshot;
}

async function persistSnapshot(
  supabase: DatabaseClient,
  snapshot: ThreadStateSnapshot,
) {
  try {
    await saveSnapshot(supabase, snapshot);
  } catch (error) {
    console.error("Failed to persist continuity snapshot.", {
      turnId: snapshot.turn_id,
      threadId: snapshot.thread_id,
      branchId: snapshot.branch_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function materializeSnapshotFromTurns(args: {
  supabase: DatabaseClient;
  userId: string;
  turns: ChatTurnRecord[];
  turn: ChatTurnRecord;
  connection: ConnectionRecord;
  modelId: string;
  character: CharacterBundle;
  snapshotCache: Map<string, ThreadStateSnapshot | null>;
}) {
  const cached = args.snapshotCache.get(args.turn.id);
  if (cached !== undefined) {
    return cached;
  }

  const existing = await getSnapshot(args.supabase, args.userId, args.turn.id);
  if (existing) {
    args.snapshotCache.set(args.turn.id, existing);
    return existing;
  }

  let previousSnapshot: ThreadStateSnapshot | null = null;
  if (args.turn.parent_turn_id) {
    const parentTurn = args.turns.find((turn) => turn.id === args.turn.parent_turn_id) ?? null;
    previousSnapshot = parentTurn
      ? await materializeSnapshotFromTurns({
          ...args,
          turn: parentTurn,
        })
      : await getSnapshot(args.supabase, args.userId, args.turn.parent_turn_id);
  }

  const turnPath = buildTurnPath(args.turns, args.turn.id);
  const recentMessages = turnPath
    .filter((turn) => turn.generation_status === "committed")
    .slice(-RECENT_RECONCILIATION_TURN_WINDOW)
    .flatMap((turn) => toTranscriptMessages(turn));

  try {
    const reconciliation = await reconcileTurnState({
      connection: args.connection,
      modelId: args.modelId,
      character: args.character,
      previousSnapshot,
      recentMessages,
    });

    const snapshot = buildSnapshotFromReconciliation({
      turnId: args.turn.id,
      threadId: args.turn.thread_id,
      branchId: args.turn.branch_origin_id,
      previousSnapshot,
      reconciliation,
    });

    await persistSnapshot(args.supabase, snapshot);
    args.snapshotCache.set(args.turn.id, snapshot);

    if (reconciliation.timelineEvent) {
      try {
        await insertTimelineEvent(args.supabase, {
          thread_id: args.turn.thread_id,
          branch_id: args.turn.branch_origin_id,
          turn_id: args.turn.id,
          title: reconciliation.timelineEvent.title,
          detail: reconciliation.timelineEvent.detail,
          importance: reconciliation.timelineEvent.importance,
        });
      } catch (error) {
        console.error("Failed to persist continuity timeline event.", {
          turnId: args.turn.id,
          threadId: args.turn.thread_id,
          branchId: args.turn.branch_origin_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return snapshot;
  } catch (error) {
    console.error("Continuity reconciliation fell back to deterministic snapshot.", {
      turnId: args.turn.id,
      threadId: args.turn.thread_id,
      branchId: args.turn.branch_origin_id,
      error: error instanceof Error ? error.message : String(error),
    });

    const fallback = buildFallbackSnapshot({
      turn: args.turn,
      previousSnapshot,
      recentMessages,
    });
    await persistSnapshot(args.supabase, fallback);
    args.snapshotCache.set(args.turn.id, fallback);
    return fallback;
  }
}

export async function materializeSnapshotForTurn(args: {
  supabase: DatabaseClient;
  userId: string;
  threadId: string;
  turnId: string;
  connection: ConnectionRecord;
  modelId: string;
  character: CharacterBundle;
}) {
  const turns = await listTurnsForThread(args.supabase, args.threadId);
  const turn = turns.find((entry) => entry.id === args.turnId) ?? null;
  if (!turn || turn.generation_status !== "committed") {
    return null;
  }

  return materializeSnapshotFromTurns({
    supabase: args.supabase,
    userId: args.userId,
    turns,
    turn,
    connection: args.connection,
    modelId: args.modelId,
    character: args.character,
    snapshotCache: new Map(),
  });
}
