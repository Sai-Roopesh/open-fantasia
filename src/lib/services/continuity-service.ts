import { runContinuityExtraction } from "@/lib/ai/continuity";
import type { ExtractionOutput } from "@/lib/ai/state-extraction";
import type { DatabaseClient } from "@/lib/data/shared";
import { listTurnsForThread } from "@/lib/data/turns";
import {
  getWorldSnapshot,
  getWorldSnapshotsForTurns,
  saveWorldSnapshot,
} from "@/lib/data/world-state";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { buildTurnPath, toTranscriptMessages } from "@/lib/domain/turn-projections";
import {
  buildEmptyDurableSnapshot,
  parseWorldSnapshot,
} from "@/lib/domain/world-snapshot";
import { applyExtractionToSnapshot } from "@/lib/domain/world-state-reducer";
import type {
  CharacterRecord,
  ConnectionRecord,
  DurableMemorySnapshot,
  WorldSnapshotRecord,
} from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTEXT_WINDOW_TURNS = 15;
const DEFRAG_EVERY = 10;

function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return JSON.stringify(error);
}

function shouldDefrag(committedTurnCount: number): boolean {
  return committedTurnCount > 0 && committedTurnCount % DEFRAG_EVERY === 0;
}

/**
 * Persists timeline events emitted by an extraction, resolving any `NEW:`
 * entity references to the ids the reducer assigned and dropping non-UUID refs.
 */
async function persistTimelineEvents(
  supabase: DatabaseClient,
  args: {
    threadId: string;
    branchId: string;
    turnId: string;
    extraction: ExtractionOutput;
    newEntityIds: Map<string, string>;
  },
): Promise<void> {
  const { threadId, branchId, turnId, extraction, newEntityIds } = args;
  const resolveRef = (value: string): string => {
    const key = value.startsWith("NEW:") ? value : `NEW:${value}`;
    return newEntityIds.get(key) ?? value;
  };

  for (const event of extraction.timeline_events) {
    try {
      const affected_entity_ids = (event.affected_entity_ids ?? [])
        .map(resolveRef)
        .filter((id) => UUID_PATTERN.test(id));
      const affected_relationship_ids = (event.affected_relationship_ids ?? []).filter((id) =>
        UUID_PATTERN.test(id),
      );

      await insertTimelineEvent(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        turn_id: turnId,
        title: event.title,
        detail: event.detail,
        importance: event.importance,
        event_type: event.event_type,
        affected_entity_ids,
        affected_relationship_ids,
      });
    } catch (error) {
      console.error("[HCE] Failed to persist timeline event.", {
        turnId,
        threadId,
        error: serializeError(error),
      });
    }
  }
}

/**
 * Materializes (and persists) the durable world snapshot for a committed turn.
 *
 * The entire turn's world mutation is now a single atomic JSONB upsert:
 *   load ancestor snapshot → extract (AI) → reduce in memory → upsert.
 * There is no longer any window where world state can be partially written.
 */
export async function materializeSnapshotForTurn(args: {
  supabase: DatabaseClient;
  userId: string;
  threadId: string;
  turnId: string;
  connection: ConnectionRecord;
  modelId: string;
  character: CharacterRecord;
}): Promise<DurableMemorySnapshot | null> {
  const { supabase, threadId, turnId, connection, modelId, character } = args;

  const turns = await listTurnsForThread(supabase, threadId);
  const turn = turns.find((t) => t.id === turnId) ?? null;
  if (!turn || turn.generation_status !== "committed") {
    return null;
  }

  const branchId = turn.branch_origin_id;

  // Idempotent: if this turn already has a snapshot, return it as-is.
  const existingSnapshot = await getWorldSnapshot(supabase, turnId);
  if (existingSnapshot) {
    return parseWorldSnapshot(existingSnapshot);
  }

  const turnPath = buildTurnPath(turns, turnId);

  // Find the nearest ancestor snapshot in a single query over the path turns,
  // instead of one round-trip per ancestor.
  const ancestorIds = turnPath.slice(0, -1).map((t) => t.id);
  const ancestorSnapshots = await getWorldSnapshotsForTurns(supabase, ancestorIds);
  const ancestorById = new Map(ancestorSnapshots.map((s) => [s.turn_id, s]));
  let previousSnapshotRecord: WorldSnapshotRecord | null = null;
  for (let i = turnPath.length - 2; i >= 0; i--) {
    const found = ancestorById.get(turnPath[i].id);
    if (found) {
      previousSnapshotRecord = found;
      break;
    }
  }

  const previousSnapshot = previousSnapshotRecord
    ? parseWorldSnapshot(previousSnapshotRecord)
    : buildEmptyDurableSnapshot(turnId);

  const committedTurns = turnPath.filter((t) => t.generation_status === "committed");
  const isDefrag = shouldDefrag(committedTurns.length);
  const windowSize = isDefrag ? committedTurns.length : CONTEXT_WINDOW_TURNS;
  const recentMessages = committedTurns.slice(-windowSize).flatMap((t) => toTranscriptMessages(t));

  try {
    const extraction = await runContinuityExtraction({
      connection,
      modelId,
      character,
      currentSnapshot: previousSnapshot,
      recentMessages,
      isFullMaterialization: isDefrag,
    });

    const { snapshot, newEntityIds } = applyExtractionToSnapshot({
      previous: previousSnapshot,
      extraction,
      turnId,
      newId: () => crypto.randomUUID(),
    });

    await saveWorldSnapshot(supabase, {
      turnId,
      threadId,
      branchId,
      basedOnTurnId: previousSnapshotRecord?.turn_id ?? null,
      worldState: snapshot,
      version: snapshot.metadata.version,
      isFullMaterialization: isDefrag,
    });

    await persistTimelineEvents(supabase, {
      threadId,
      branchId,
      turnId,
      extraction,
      newEntityIds,
    });

    return snapshot;
  } catch (error) {
    console.error("[HCE] State extraction failed. Saving deterministic carry-forward.", {
      turnId,
      threadId,
      error: serializeError(error),
    });

    // Carry the previous world state forward unchanged (single atomic upsert),
    // only advancing metadata. No partial state is possible.
    const fallback: DurableMemorySnapshot = structuredClone(previousSnapshot);
    fallback.metadata.current_turn_id = turnId;
    fallback.metadata.version = previousSnapshot.metadata.version + 1;
    fallback.narrative_state.last_turn_beat = "The latest exchange shifted the scene.";

    try {
      await saveWorldSnapshot(supabase, {
        turnId,
        threadId,
        branchId,
        basedOnTurnId: previousSnapshotRecord?.turn_id ?? null,
        worldState: fallback,
        version: fallback.metadata.version,
        isFullMaterialization: false,
      });
      return fallback;
    } catch (persistError) {
      console.error("[HCE] Failed to persist fallback snapshot.", {
        turnId,
        threadId,
        error: serializeError(persistError),
      });
      return previousSnapshot;
    }
  }
}
