import type { ExtractionOutput } from "@/lib/ai/state-extraction";
import type {
  DurableMemorySnapshot,
  EntityType,
  FactType,
  RelationshipType,
} from "@/lib/types";

type EntityState = DurableMemorySnapshot["entity_state"][number];
type FactRef = { id: string; body: string };

const FACT_TYPE_TO_FIELD: Record<FactType, keyof EntityState> = {
  knowledge: "knowledge_boundary",
  trait: "traits",
  goal: "goals",
  secret: "secrets",
  ability: "abilities",
  possession: "possessions",
};

function emptyEntity(id: string, name: string, type: EntityType): EntityState {
  return {
    entity_id: id,
    canonical_name: name,
    entity_type: type,
    aliases: [],
    is_present: true,
    primary_emotion: "neutral",
    emotion_intensity: 5,
    emotion_catalyst: "",
    knowledge_boundary: [],
    traits: [],
    goals: [],
    secrets: [],
    abilities: [],
    possessions: [],
  };
}

/**
 * Resolves a possibly-`NEW:`-prefixed reference emitted by the extractor to a
 * concrete id. Newly added entities/locations are referenced by
 * `NEW:<canonical_name>` until their real id is generated within this apply.
 */
function resolveRef(value: string | undefined, map: Map<string, string>): string {
  if (!value) return "";
  const key = value.startsWith("NEW:") ? value : `NEW:${value}`;
  return map.get(key) ?? value;
}

/**
 * Recomputes the POV-derived spatial fields (current_location, adjacent_locations)
 * from the authoritative known_locations / edges / entity_placements. The POV
 * entity is the first `character`-type entity that has a placement — for this
 * single-character roleplay product that is the roleplay character.
 */
function recomputeSpatialDerived(snapshot: DurableMemorySnapshot): void {
  const spatial = snapshot.spatial_state;
  const locationById = new Map(spatial.known_locations.map((l) => [l.id, l]));

  const povEntity = snapshot.entity_state.find((e) => e.entity_type === "character");
  const povPlacement = povEntity
    ? spatial.entity_placements.find((p) => p.entity_id === povEntity.entity_id)
    : undefined;
  const current = povPlacement ? locationById.get(povPlacement.location_id) ?? null : null;

  spatial.current_location = current
    ? {
        id: current.id,
        name: current.name,
        description: current.description,
        environmental_modifiers: current.environmental_modifiers,
      }
    : null;

  if (!current) {
    spatial.adjacent_locations = [];
    return;
  }

  const adjacentIds = new Set<string>();
  for (const edge of spatial.edges) {
    if (edge.from_location_id === current.id) adjacentIds.add(edge.to_location_id);
    if (edge.is_bidirectional && edge.to_location_id === current.id) {
      adjacentIds.add(edge.from_location_id);
    }
  }
  spatial.adjacent_locations = [...adjacentIds]
    .map((id) => locationById.get(id))
    .filter((l): l is (typeof spatial.known_locations)[number] => l !== undefined)
    .map((l) => ({ id: l.id, name: l.name }));
}

export type ReducerResult = {
  snapshot: DurableMemorySnapshot;
  /** NEW:<name> → generated id, so callers can resolve timeline event refs. */
  newEntityIds: Map<string, string>;
  newLocationIds: Map<string, string>;
};

/**
 * Pure HCE reducer: apply a validated ExtractionOutput to the previous durable
 * snapshot and return the next snapshot. No I/O. This replaces the old
 * applyMutationsToDb, which spread one turn's changes across ~30 sequential,
 * transaction-less writes to 7 normalized tables. Here the whole turn is a
 * single in-memory transform; the service persists the result as one atomic
 * JSONB upsert.
 *
 * `newId` is injected so tests can assert deterministic output.
 */
export function applyExtractionToSnapshot(args: {
  previous: DurableMemorySnapshot;
  extraction: ExtractionOutput;
  turnId: string;
  newId: () => string;
}): ReducerResult {
  const { previous, extraction, turnId, newId } = args;
  const snapshot: DurableMemorySnapshot = structuredClone(previous);

  const newEntityIds = new Map<string, string>();
  const newLocationIds = new Map<string, string>();

  const entityByName = new Map(
    snapshot.entity_state.map((e) => [e.canonical_name.toLowerCase(), e]),
  );

  // --- Entities ---
  for (const m of extraction.entity_mutations) {
    if (m.op === "add") {
      const name = m.canonical_name ?? "";
      const existing = entityByName.get(name.toLowerCase());
      if (existing) {
        newEntityIds.set(`NEW:${name}`, existing.entity_id);
        if (m.is_present !== undefined) existing.is_present = m.is_present;
        if (m.primary_emotion) existing.primary_emotion = m.primary_emotion;
        if (m.emotion_intensity !== undefined) existing.emotion_intensity = m.emotion_intensity;
        if (m.emotion_catalyst) existing.emotion_catalyst = m.emotion_catalyst;
        if (m.aliases) existing.aliases = m.aliases;
      } else {
        const entity = emptyEntity(newId(), name, (m.entity_type ?? "npc") as EntityType);
        entity.aliases = m.aliases ?? [];
        entity.is_present = m.is_present ?? true;
        entity.primary_emotion = m.primary_emotion ?? "neutral";
        entity.emotion_intensity = m.emotion_intensity ?? 5;
        entity.emotion_catalyst = m.emotion_catalyst ?? "";
        snapshot.entity_state.push(entity);
        entityByName.set(name.toLowerCase(), entity);
        newEntityIds.set(`NEW:${name}`, entity.entity_id);
      }
    } else if (m.op === "update") {
      const entity = snapshot.entity_state.find((e) => e.entity_id === m.entity_id);
      if (entity && m.changes) {
        if (m.changes.is_present !== undefined) entity.is_present = m.changes.is_present;
        if (m.changes.primary_emotion) entity.primary_emotion = m.changes.primary_emotion;
        if (m.changes.emotion_intensity !== undefined)
          entity.emotion_intensity = m.changes.emotion_intensity;
        if (m.changes.emotion_catalyst) entity.emotion_catalyst = m.changes.emotion_catalyst;
        if (m.changes.aliases) entity.aliases = m.changes.aliases;
      }
    } else if (m.op === "invalidate") {
      const removedId = m.entity_id;
      snapshot.entity_state = snapshot.entity_state.filter((e) => e.entity_id !== removedId);
      // Drop now-dangling relationships and placements that referenced it.
      snapshot.relational_state = snapshot.relational_state.filter(
        (r) => r.source_entity_id !== removedId && r.target_entity_id !== removedId,
      );
      snapshot.spatial_state.entity_placements = snapshot.spatial_state.entity_placements.filter(
        (p) => p.entity_id !== removedId,
      );
    }
  }

  // --- Facts (nested per entity, by fact_type) ---
  for (const m of extraction.fact_mutations) {
    if (m.op === "add") {
      const entityId = resolveRef(m.entity_id, newEntityIds);
      const entity = snapshot.entity_state.find((e) => e.entity_id === entityId);
      if (entity && m.fact_type && m.body) {
        const field = FACT_TYPE_TO_FIELD[m.fact_type as FactType];
        (entity[field] as FactRef[]).push({ id: newId(), body: m.body });
      }
    } else if (m.op === "invalidate") {
      for (const entity of snapshot.entity_state) {
        for (const field of Object.values(FACT_TYPE_TO_FIELD)) {
          entity[field] = (entity[field] as FactRef[]).filter((f) => f.id !== m.fact_id) as never;
        }
      }
    }
  }

  // --- Relationships ---
  const nameById = new Map(snapshot.entity_state.map((e) => [e.entity_id, e.canonical_name]));
  for (const m of extraction.relationship_mutations) {
    if (m.op === "add") {
      const sourceId = resolveRef(m.source_entity_id, newEntityIds);
      const targetId = resolveRef(m.target_entity_id, newEntityIds);
      snapshot.relational_state.push({
        relationship_id: newId(),
        source_entity_id: sourceId,
        source_entity_name: nameById.get(sourceId) ?? "",
        target_entity_id: targetId,
        target_entity_name: nameById.get(targetId) ?? "",
        relationship_type: (m.relationship_type ?? "other") as RelationshipType,
        dynamic_status: m.dynamic_status ?? "",
      });
    } else if (m.op === "update") {
      const rel = snapshot.relational_state.find((r) => r.relationship_id === m.relationship_id);
      if (rel && m.changes) {
        if (m.changes.dynamic_status) rel.dynamic_status = m.changes.dynamic_status;
        if (m.changes.relationship_type)
          rel.relationship_type = m.changes.relationship_type as RelationshipType;
      }
    } else if (m.op === "invalidate") {
      snapshot.relational_state = snapshot.relational_state.filter(
        (r) => r.relationship_id !== m.relationship_id,
      );
    }
  }

  // --- Locations ---
  const locationByName = new Map(
    snapshot.spatial_state.known_locations.map((l) => [l.name.toLowerCase(), l]),
  );
  for (const m of extraction.location_mutations) {
    if (m.op === "add") {
      const name = m.canonical_name ?? "";
      const existing = locationByName.get(name.toLowerCase());
      if (existing) {
        newLocationIds.set(`NEW:${name}`, existing.id);
        if (m.description) existing.description = m.description;
        if (m.environmental_modifiers) existing.environmental_modifiers = m.environmental_modifiers;
      } else {
        const location = {
          id: newId(),
          name,
          description: m.description ?? "",
          environmental_modifiers: m.environmental_modifiers ?? [],
        };
        snapshot.spatial_state.known_locations.push(location);
        locationByName.set(name.toLowerCase(), location);
        newLocationIds.set(`NEW:${name}`, location.id);
      }
    } else if (m.op === "update") {
      const location = snapshot.spatial_state.known_locations.find((l) => l.id === m.location_id);
      if (location && m.changes) {
        if (m.changes.description) location.description = m.changes.description;
        if (m.changes.environmental_modifiers)
          location.environmental_modifiers = m.changes.environmental_modifiers;
      }
    }
  }

  // --- Location edges ---
  for (const m of extraction.location_edge_mutations) {
    if (m.op === "add") {
      snapshot.spatial_state.edges.push({
        edge_id: newId(),
        from_location_id: resolveRef(m.from_location_id, newLocationIds),
        to_location_id: resolveRef(m.to_location_id, newLocationIds),
        is_bidirectional: m.is_bidirectional ?? true,
      });
    } else if (m.op === "invalidate") {
      snapshot.spatial_state.edges = snapshot.spatial_state.edges.filter(
        (e) => e.edge_id !== m.edge_id,
      );
    }
  }

  // --- Placements (move) ---
  const locNameById = new Map(
    snapshot.spatial_state.known_locations.map((l) => [l.id, l.name]),
  );
  for (const m of extraction.placement_mutations) {
    const entityId = resolveRef(m.entity_id, newEntityIds);
    const locationId = resolveRef(m.to_location_id, newLocationIds);
    snapshot.spatial_state.entity_placements = snapshot.spatial_state.entity_placements.filter(
      (p) => p.entity_id !== entityId,
    );
    snapshot.spatial_state.entity_placements.push({
      entity_id: entityId,
      entity_name: nameById.get(entityId) ?? "",
      location_id: locationId,
      location_name: locNameById.get(locationId) ?? "",
      micro_position: m.micro_position ?? "",
    });
  }

  // --- Narrative threads ---
  for (const m of extraction.narrative_thread_mutations) {
    if (m.op === "add") {
      snapshot.narrative_state.active_threads.push({
        thread_id: newId(),
        objective: m.objective ?? "",
        status: "open",
        dependencies: [],
      });
    } else if (m.op === "update") {
      const thread = snapshot.narrative_state.active_threads.find(
        (t) => t.thread_id === m.thread_id,
      );
      if (thread && m.changes) {
        if (m.changes.objective) thread.objective = m.changes.objective;
        if (m.changes.status) thread.status = m.changes.status;
      }
    } else if (m.op === "resolve") {
      const thread = snapshot.narrative_state.active_threads.find(
        (t) => t.thread_id === m.thread_id,
      );
      if (thread) {
        snapshot.narrative_state.resolved_threads.push(thread.objective);
        snapshot.narrative_state.active_threads = snapshot.narrative_state.active_threads.filter(
          (t) => t.thread_id !== m.thread_id,
        );
      }
    }
  }
  // Move any thread updated to 'resolved' into resolved_threads.
  const stillResolving = snapshot.narrative_state.active_threads.filter(
    (t) => t.status === "resolved",
  );
  for (const t of stillResolving) {
    snapshot.narrative_state.resolved_threads.push(t.objective);
  }
  snapshot.narrative_state.active_threads = snapshot.narrative_state.active_threads.filter(
    (t) => t.status !== "resolved",
  );

  // --- Narrative summaries + metadata ---
  snapshot.narrative_state.story_summary = extraction.story_summary;
  snapshot.narrative_state.scene_summary = extraction.scene_summary;
  snapshot.narrative_state.last_turn_beat = extraction.last_turn_beat;
  snapshot.metadata.current_turn_id = turnId;
  snapshot.metadata.narrative_timestamp = extraction.narrative_timestamp;
  snapshot.metadata.transition_type = extraction.transition_type;
  snapshot.metadata.version = previous.metadata.version + 1;

  recomputeSpatialDerived(snapshot);

  return { snapshot, newEntityIds, newLocationIds };
}
