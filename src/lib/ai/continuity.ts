import type { DatabaseClient } from "@/lib/data/shared";
import { getWorldSnapshot, saveWorldSnapshot } from "@/lib/data/world-state";
import {
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
import { listTurnsForThread, toTranscriptMessages } from "@/lib/data/turns";
import { buildTurnPath } from "@/lib/threads/read-model";
import {
  materializeDurableSnapshot,
  buildEmptyDurableSnapshot,
} from "@/lib/ai/state-materializer";
import {
  extractStateChanges,
  type ExtractionOutput,
} from "@/lib/ai/state-extraction";
import {
  validateAllMutations,
  validateAndPartition,
  validateEntityMutations,
  validateFactMutations,
  validateRelationshipMutations,
  validateSpatialMutations,
  validateNarrativeThreadMutations,
  validateLocationEdgeMutations,
  type MutationOp,
} from "@/lib/ai/state-validator";
import { reflectOnFailedExtraction } from "@/lib/ai/state-reflector";
import { getTextFromMessage } from "@/lib/ai/message-text";
import type {
  ConnectionRecord,
  CharacterRecord,
  DurableMemorySnapshot,
  WorldSnapshotRecord,
  EntityType,
  FactType,
  RelationshipType,
} from "@/lib/types";

const RECENT_EXTRACTION_TURN_WINDOW = 15;
const DEFRAG_INTERVAL = 10;

function stripInvalidMutations(
  extraction: ExtractionOutput,
  snapshot: DurableMemorySnapshot,
): ExtractionOutput {
  const entities = validateAndPartition(extraction.entity_mutations as MutationOp[], snapshot, validateEntityMutations);
  const facts = validateAndPartition(extraction.fact_mutations as MutationOp[], snapshot, validateFactMutations);
  const relationships = validateAndPartition(extraction.relationship_mutations as MutationOp[], snapshot, validateRelationshipMutations);
  const spatial = validateAndPartition(
    extraction.placement_mutations as MutationOp[],
    snapshot,
    (muts, snap) => validateSpatialMutations(muts, extraction.location_mutations as MutationOp[], snap),
  );
  const narratives = validateAndPartition(extraction.narrative_thread_mutations as MutationOp[], snapshot, validateNarrativeThreadMutations);
  const edges = validateAndPartition(extraction.location_edge_mutations as MutationOp[], snapshot, validateLocationEdgeMutations);

  return {
    ...extraction,
    entity_mutations: entities.valid as ExtractionOutput["entity_mutations"],
    fact_mutations: facts.valid as ExtractionOutput["fact_mutations"],
    relationship_mutations: relationships.valid as ExtractionOutput["relationship_mutations"],
    placement_mutations: spatial.valid as ExtractionOutput["placement_mutations"],
    narrative_thread_mutations: narratives.valid as ExtractionOutput["narrative_thread_mutations"],
    location_edge_mutations: edges.valid as ExtractionOutput["location_edge_mutations"],
  };
}

function resolveNewRef(value: string, map: Map<string, string>): string {
  const key = value.startsWith("NEW:") ? value : `NEW:${value}`;
  return map.get(key) ?? value;
}

async function applyMutationsToDb(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
  turnId: string,
  extraction: ExtractionOutput,
): Promise<void> {
  const newEntityIds = new Map<string, string>();
  const newLocationIds = new Map<string, string>();

  for (const m of extraction.entity_mutations) {
    if (m.op === "add") {
      const result = await insertEntity(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        canonical_name: m.canonical_name,
        entity_type: m.entity_type as EntityType,
        aliases: m.aliases ?? [],
        is_present: m.is_present ?? true,
        primary_emotion: m.primary_emotion ?? "neutral",
        emotion_intensity: m.emotion_intensity ?? 5,
        emotion_catalyst: m.emotion_catalyst ?? "",
        valid_from_turn_id: turnId,
      });
      newEntityIds.set(`NEW:${m.canonical_name}`, result.id);
    } else if (m.op === "update") {
      await updateEntity(supabase, m.entity_id, m.changes);
    } else if (m.op === "invalidate") {
      await invalidateEntity(supabase, m.entity_id, turnId);
    }
  }

  for (const m of extraction.fact_mutations) {
    if (m.op === "add") {
      const resolvedEntityId = resolveNewRef(m.entity_id, newEntityIds);
      await insertEntityFact(supabase, {
        entity_id: resolvedEntityId,
        thread_id: threadId,
        branch_id: branchId,
        fact_type: m.fact_type as FactType,
        body: m.body,
        valid_from_turn_id: turnId,
      });
    } else if (m.op === "invalidate") {
      await invalidateEntityFact(supabase, m.fact_id, turnId);
    }
  }

  for (const m of extraction.relationship_mutations) {
    if (m.op === "add") {
      const resolvedSourceId = resolveNewRef(m.source_entity_id, newEntityIds);
      const resolvedTargetId = resolveNewRef(m.target_entity_id, newEntityIds);
      await insertRelationship(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        source_entity_id: resolvedSourceId,
        target_entity_id: resolvedTargetId,
        relationship_type: m.relationship_type as RelationshipType,
        dynamic_status: m.dynamic_status,
        valid_from_turn_id: turnId,
      });
    } else if (m.op === "update") {
      await updateRelationship(supabase, m.relationship_id, m.changes);
    } else if (m.op === "invalidate") {
      await invalidateRelationship(supabase, m.relationship_id, turnId);
    }
  }

  for (const m of extraction.location_mutations) {
    if (m.op === "add") {
      const result = await insertLocation(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        canonical_name: m.canonical_name,
        description: m.description ?? "",
        environmental_modifiers: m.environmental_modifiers ?? [],
        valid_from_turn_id: turnId,
      });
      newLocationIds.set(`NEW:${m.canonical_name}`, result.id);
    } else if (m.op === "update") {
      await updateLocation(supabase, m.location_id, m.changes);
    }
  }

  for (const m of extraction.location_edge_mutations) {
    if (m.op === "add") {
      const resolvedFromId = resolveNewRef(m.from_location_id, newLocationIds);
      const resolvedToId = resolveNewRef(m.to_location_id, newLocationIds);
      await insertLocationEdge(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        from_location_id: resolvedFromId,
        to_location_id: resolvedToId,
        is_bidirectional: m.is_bidirectional ?? true,
        valid_from_turn_id: turnId,
      });
    } else if (m.op === "invalidate") {
      await invalidateLocationEdge(supabase, m.edge_id, turnId);
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
        objective: m.objective,
        status: "open",
        dependency_ids: [],
        valid_from_turn_id: turnId,
      });
    } else if (m.op === "update") {
      await updateNarrativeThread(supabase, m.thread_id, m.changes);
    } else if (m.op === "resolve") {
      await updateNarrativeThread(supabase, m.thread_id, { status: "resolved" });
    }
  }

  for (const event of extraction.timeline_events) {
    try {
      await insertTimelineEvent(supabase, {
        thread_id: threadId,
        branch_id: branchId,
        turn_id: turnId,
        title: event.title,
        detail: event.detail,
        importance: event.importance,
        event_type: event.event_type,
        affected_entity_ids: event.affected_entity_ids ?? [],
        affected_relationship_ids: event.affected_relationship_ids ?? [],
      });
    } catch (error) {
      console.error("[HCE] Failed to persist timeline event.", {
        turnId,
        threadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function shouldDefrag(turnCount: number): boolean {
  return turnCount > 0 && turnCount % DEFRAG_INTERVAL === 0;
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
  const {
    supabase,
    threadId,
    turnId,
    connection,
    modelId,
    character,
  } = args;

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

  let previousSnapshotRecord: WorldSnapshotRecord | null = null;
  if (turn.parent_turn_id) {
    previousSnapshotRecord = await getWorldSnapshot(supabase, turn.parent_turn_id);
  }

  const currentSnapshot = previousSnapshotRecord
    ? await materializeDurableSnapshot(supabase, threadId, branchId, turnId, previousSnapshotRecord)
    : buildEmptyDurableSnapshot(turnId);

  const turnPath = buildTurnPath(turns, turnId);
  const committedTurns = turnPath.filter((t) => t.generation_status === "committed");

  const isDefrag = shouldDefrag(committedTurns.length);
  const windowSize = isDefrag
    ? committedTurns.length
    : RECENT_EXTRACTION_TURN_WINDOW;

  const recentMessages = committedTurns
    .slice(-windowSize)
    .flatMap((t) => toTranscriptMessages(t));

  try {
    let extraction = await extractStateChanges({
      connection,
      modelId,
      character,
      currentSnapshot,
      recentMessages,
      isFullMaterialization: isDefrag,
    });

    const validationResult = validateAllMutations(extraction, currentSnapshot);

    if (validationResult.totalErrors > 0) {
      if (validationResult.shouldReflect) {
        console.warn("[HCE] Extraction failed validation, attempting reflection.", {
          turnId,
          threadId,
          totalErrors: validationResult.totalErrors,
        });

        const transcript = recentMessages
          .map((msg) => `${msg.role.toUpperCase()}: ${getTextFromMessage(msg)}`)
          .join("\n\n");

        const reflected = await reflectOnFailedExtraction({
          connection,
          modelId,
          character,
          currentSnapshot,
          recentTranscript: transcript,
          previousOutput: extraction,
          validationResult,
        });

        if (reflected) {
          const revalidation = validateAllMutations(reflected, currentSnapshot);
          if (revalidation.totalErrors === 0) {
            extraction = reflected;
          } else {
            console.warn("[HCE] Reflection still has errors. Stripping invalid mutations.", {
              turnId,
              threadId,
              reflectedErrors: revalidation.totalErrors,
            });
            extraction = stripInvalidMutations(reflected, currentSnapshot);
          }
        } else {
          console.warn("[HCE] Reflection returned nothing. Stripping invalid mutations from original.", { turnId, threadId });
          extraction = stripInvalidMutations(extraction, currentSnapshot);
        }
      } else {
        // Errors exist but under threshold — still strip the bad ones
        extraction = stripInvalidMutations(extraction, currentSnapshot);
      }
    }

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
      error: error instanceof Error ? error.message : String(error),
    });

    const fallbackRecord: WorldSnapshotRecord = {
      turn_id: turnId,
      thread_id: threadId,
      branch_id: branchId,
      based_on_turn_id: previousSnapshotRecord?.turn_id ?? null,
      story_summary: previousSnapshotRecord?.story_summary ?? "",
      scene_summary: previousSnapshotRecord?.scene_summary ?? "The scene advanced through the latest exchange.",
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
        error: persistError instanceof Error ? persistError.message : String(persistError),
      });
    }

    return currentSnapshot;
  }
}
