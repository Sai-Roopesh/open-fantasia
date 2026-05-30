import { runContinuityExtraction } from "@/lib/ai/continuity";
import type { ExtractionOutput } from "@/lib/ai/state-extraction";
import {
  buildEmptyDurableSnapshot,
  materializeDurableSnapshot,
} from "@/lib/ai/state-materializer";
import type { DatabaseClient } from "@/lib/data/shared";
import { listTurnsForThread, toTranscriptMessages } from "@/lib/data/turns";
import {
  getWorldSnapshot,
  saveWorldSnapshot,
  getActiveEntities,
  getActiveLocations,
  insertEntity,
  insertEntityFact,
  insertRelationship,
  insertLocation,
  insertLocationEdge,
  insertEntityPlacement,
  insertNarrativeThread,
  invalidateEntity,
  invalidateEntityFact,
  invalidateRelationship,
  invalidateLocationEdge,
  invalidateEntityPlacement,
  updateEntity,
  updateRelationship,
  updateLocation,
  updateNarrativeThread,
} from "@/lib/data/world-state";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { buildTurnPath } from "@/lib/domain/turn-projections";
import type {
  CharacterRecord,
  ConnectionRecord,
  DurableMemorySnapshot,
  EntityType,
  FactType,
  RelationshipType,
  WorldSnapshotRecord,
} from "@/lib/types";

function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return JSON.stringify(error);
}

function resolveNewRef(value: string, map: Map<string, string>): string {
  const key = value.startsWith("NEW:") ? value : `NEW:${value}`;
  return map.get(key) ?? value;
}

function shouldDefrag(turnCount: number): boolean {
  return turnCount > 0 && turnCount % 10 === 0;
}

// NOTE: these DB writes are sequential with no transaction boundary.
// If the process crashes mid-apply, world state will be partially written.
// The clean solution is a Postgres RPC that accepts the full extraction as JSON
// and applies it atomically — a single-site change once ready.
async function applyMutationsToDb(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
  turnId: string,
  extraction: ExtractionOutput,
): Promise<void> {
  const newEntityIds = new Map<string, string>();
  const newLocationIds = new Map<string, string>();

  const existingEntities = await getActiveEntities(supabase, threadId, branchId);
  const entityByName = new Map(
    existingEntities.map((e) => [e.canonical_name.toLowerCase(), e]),
  );
  const existingLocations = await getActiveLocations(supabase, threadId, branchId);
  const locationByName = new Map(
    existingLocations.map((l) => [l.canonical_name.toLowerCase(), l]),
  );

  for (const m of extraction.entity_mutations) {
    if (m.op === "add") {
      const normalizedName = m.canonical_name!.toLowerCase();
      const existing = entityByName.get(normalizedName);
      if (existing) {
        newEntityIds.set(`NEW:${m.canonical_name}`, existing.id);
        const changes: Record<string, unknown> = {};
        if (m.is_present !== undefined) changes.is_present = m.is_present;
        if (m.primary_emotion) changes.primary_emotion = m.primary_emotion;
        if (m.emotion_intensity !== undefined) changes.emotion_intensity = m.emotion_intensity;
        if (m.emotion_catalyst) changes.emotion_catalyst = m.emotion_catalyst;
        if (Object.keys(changes).length > 0) {
          await updateEntity(supabase, existing.id, changes);
        }
      } else {
        const result = await insertEntity(supabase, {
          thread_id: threadId,
          branch_id: branchId,
          canonical_name: m.canonical_name!,
          entity_type: m.entity_type as EntityType,
          aliases: m.aliases ?? [],
          is_present: m.is_present ?? true,
          primary_emotion: m.primary_emotion ?? "neutral",
          emotion_intensity: m.emotion_intensity ?? 5,
          emotion_catalyst: m.emotion_catalyst ?? "",
          valid_from_turn_id: turnId,
        });
        newEntityIds.set(`NEW:${m.canonical_name}`, result.id);
        entityByName.set(normalizedName, {
          id: result.id,
          canonical_name: m.canonical_name!,
        } as (typeof existingEntities)[number]);
      }
    } else if (m.op === "update") {
      await updateEntity(supabase, m.entity_id!, m.changes!);
    } else if (m.op === "invalidate") {
      await invalidateEntity(supabase, m.entity_id!, turnId);
    }
  }

  for (const m of extraction.fact_mutations) {
    if (m.op === "add") {
      const resolvedEntityId = resolveNewRef(m.entity_id!, newEntityIds);
      await insertEntityFact(supabase, {
        entity_id: resolvedEntityId,
        thread_id: threadId,
        branch_id: branchId,
        fact_type: m.fact_type as FactType,
        body: m.body!,
        valid_from_turn_id: turnId,
      });
    } else if (m.op === "invalidate") {
      await invalidateEntityFact(supabase, m.fact_id!, turnId);
    }
  }

  for (const m of extraction.relationship_mutations) {
    if (m.op === "add") {
      const resolvedSourceId = resolveNewRef(m.source_entity_id!, newEntityIds);
      const resolvedTargetId = resolveNewRef(m.target_entity_id!, newEntityIds);
      await insertRelationship(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        source_entity_id: resolvedSourceId,
        target_entity_id: resolvedTargetId,
        relationship_type: m.relationship_type as RelationshipType,
        dynamic_status: m.dynamic_status!,
        valid_from_turn_id: turnId,
      });
    } else if (m.op === "update") {
      await updateRelationship(supabase, m.relationship_id!, m.changes!);
    } else if (m.op === "invalidate") {
      await invalidateRelationship(supabase, m.relationship_id!, turnId);
    }
  }

  for (const m of extraction.location_mutations) {
    if (m.op === "add") {
      const normalizedLocName = m.canonical_name!.toLowerCase();
      const existingLoc = locationByName.get(normalizedLocName);
      if (existingLoc) {
        newLocationIds.set(`NEW:${m.canonical_name}`, existingLoc.id);
        const changes: Record<string, unknown> = {};
        if (m.description) changes.description = m.description;
        if (m.environmental_modifiers) changes.environmental_modifiers = m.environmental_modifiers;
        if (Object.keys(changes).length > 0) {
          await updateLocation(supabase, existingLoc.id, changes);
        }
      } else {
        const result = await insertLocation(supabase, {
          thread_id: threadId,
          branch_id: branchId,
          canonical_name: m.canonical_name!,
          description: m.description ?? "",
          environmental_modifiers: m.environmental_modifiers ?? [],
          valid_from_turn_id: turnId,
        });
        newLocationIds.set(`NEW:${m.canonical_name}`, result.id);
        locationByName.set(normalizedLocName, {
          id: result.id,
          canonical_name: m.canonical_name!,
        } as (typeof existingLocations)[number]);
      }
    } else if (m.op === "update") {
      await updateLocation(supabase, m.location_id!, m.changes!);
    }
  }

  for (const m of extraction.location_edge_mutations) {
    if (m.op === "add") {
      const resolvedFromId = resolveNewRef(m.from_location_id!, newLocationIds);
      const resolvedToId = resolveNewRef(m.to_location_id!, newLocationIds);
      await insertLocationEdge(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        from_location_id: resolvedFromId,
        to_location_id: resolvedToId,
        is_bidirectional: m.is_bidirectional ?? true,
        valid_from_turn_id: turnId,
      });
    } else if (m.op === "invalidate") {
      await invalidateLocationEdge(supabase, m.edge_id!, turnId);
    }
  }

  for (const m of extraction.placement_mutations) {
    const resolvedEntityId = resolveNewRef(m.entity_id, newEntityIds);
    const resolvedLocationId = resolveNewRef(m.to_location_id, newLocationIds);
    await invalidateEntityPlacement(supabase, resolvedEntityId, turnId);
    await insertEntityPlacement(supabase, {
      thread_id: threadId,
      branch_id: branchId,
      entity_id: resolvedEntityId,
      location_id: resolvedLocationId,
      micro_position: m.micro_position ?? "",
      valid_from_turn_id: turnId,
    });
  }

  for (const m of extraction.narrative_thread_mutations) {
    if (m.op === "add") {
      await insertNarrativeThread(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        objective: m.objective!,
        status: "open",
        dependency_ids: [],
        valid_from_turn_id: turnId,
      });
    } else if (m.op === "update") {
      await updateNarrativeThread(supabase, m.thread_id!, m.changes!);
    } else if (m.op === "resolve") {
      await updateNarrativeThread(supabase, m.thread_id!, { status: "resolved" });
    }
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  for (const event of extraction.timeline_events) {
    try {
      const resolvedEntityIds = (event.affected_entity_ids ?? [])
        .map((id) => resolveNewRef(id, newEntityIds))
        .filter((id) => uuidPattern.test(id));
      const resolvedRelIds = (event.affected_relationship_ids ?? []).filter((id) =>
        uuidPattern.test(id),
      );

      await insertTimelineEvent(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        turn_id: turnId,
        title: event.title,
        detail: event.detail,
        importance: event.importance,
        event_type: event.event_type,
        affected_entity_ids: resolvedEntityIds,
        affected_relationship_ids: resolvedRelIds,
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

  const existingSnapshot = await getWorldSnapshot(supabase, turnId);
  if (existingSnapshot) {
    return materializeDurableSnapshot(supabase, threadId, branchId, turnId, existingSnapshot);
  }

  const turnPath = buildTurnPath(turns, turnId);
  let previousSnapshotRecord: WorldSnapshotRecord | null = null;
  for (let i = turnPath.length - 2; i >= 0; i--) {
    const ancestorSnapshot = await getWorldSnapshot(supabase, turnPath[i].id);
    if (ancestorSnapshot) {
      previousSnapshotRecord = ancestorSnapshot;
      break;
    }
  }

  const currentSnapshot = previousSnapshotRecord
    ? await materializeDurableSnapshot(supabase, threadId, branchId, turnId, previousSnapshotRecord)
    : buildEmptyDurableSnapshot(turnId);

  const committedTurns = turnPath.filter((t) => t.generation_status === "committed");
  const isDefrag = shouldDefrag(committedTurns.length);
  const windowSize = isDefrag ? committedTurns.length : 15;

  const recentMessages = committedTurns
    .slice(-windowSize)
    .flatMap((t) => toTranscriptMessages(t));

  try {
    const extraction = await runContinuityExtraction({
      connection,
      modelId,
      character,
      currentSnapshot,
      recentMessages,
      isFullMaterialization: isDefrag,
    });

    await applyMutationsToDb(supabase, threadId, branchId, turnId, extraction);

    const newSnapshotRecord: WorldSnapshotRecord = {
      turn_id: turnId,
      thread_id: threadId,
      branch_id: branchId,
      based_on_turn_id: previousSnapshotRecord?.turn_id ?? null,
      story_summary: extraction.story_summary,
      scene_summary: extraction.scene_summary,
      last_turn_beat: extraction.last_turn_beat,
      narrative_timestamp: extraction.narrative_timestamp,
      transition_type: extraction.transition_type,
      version: (previousSnapshotRecord?.version ?? 0) + 1,
      is_full_materialization: isDefrag,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await saveWorldSnapshot(supabase, newSnapshotRecord);

    return materializeDurableSnapshot(supabase, threadId, branchId, turnId, newSnapshotRecord);
  } catch (error) {
    console.error("[HCE] State extraction failed completely. Saving deterministic fallback.", {
      turnId,
      threadId,
      error: serializeError(error),
    });

    const fallbackRecord: WorldSnapshotRecord = {
      turn_id: turnId,
      thread_id: threadId,
      branch_id: branchId,
      based_on_turn_id: previousSnapshotRecord?.turn_id ?? null,
      story_summary: previousSnapshotRecord?.story_summary ?? "",
      scene_summary:
        previousSnapshotRecord?.scene_summary ?? "The scene advanced through the latest exchange.",
      last_turn_beat: "The latest exchange shifted the scene.",
      narrative_timestamp: previousSnapshotRecord?.narrative_timestamp ?? "",
      transition_type: "continuation",
      version: (previousSnapshotRecord?.version ?? 0) + 1,
      is_full_materialization: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await saveWorldSnapshot(supabase, fallbackRecord);
    } catch (persistError) {
      console.error("[HCE] Failed to persist fallback snapshot.", {
        turnId,
        threadId,
        error: serializeError(persistError),
      });
    }

    return currentSnapshot;
  }
}
