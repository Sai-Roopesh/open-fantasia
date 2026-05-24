import type { DatabaseClient } from "@/lib/data/shared";
import type {
  DurableMemorySnapshot,
  WorldSnapshotRecord,
  WorldEntityRecord,
  WorldEntityFactRecord,
  WorldRelationshipRecord,
  WorldLocationRecord,
  WorldLocationEdgeRecord,
  WorldEntityPlacementRecord,
  WorldNarrativeThreadRecord,
  FactType,
} from "@/lib/types";

type ActiveWorldState = {
  entities: WorldEntityRecord[];
  facts: WorldEntityFactRecord[];
  relationships: WorldRelationshipRecord[];
  locations: WorldLocationRecord[];
  edges: WorldLocationEdgeRecord[];
  placements: WorldEntityPlacementRecord[];
  narrativeThreads: WorldNarrativeThreadRecord[];
};

async function fetchActiveWorldState(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<ActiveWorldState> {
  const baseFilter = { thread_id: threadId, branch_id: branchId };

  const [
    { data: entities, error: entitiesErr },
    { data: facts, error: factsErr },
    { data: relationships, error: relsErr },
    { data: locations, error: locsErr },
    { data: edges, error: edgesErr },
    { data: placements, error: placementsErr },
    { data: narrativeThreads, error: narrativeErr },
  ] = await Promise.all([
    supabase
      .from("world_entities")
      .select("*")
      .eq("thread_id", baseFilter.thread_id)
      .eq("branch_id", baseFilter.branch_id)
      .is("invalidated_at_turn_id", null),
    supabase
      .from("world_entity_facts")
      .select("*")
      .eq("thread_id", baseFilter.thread_id)
      .eq("branch_id", baseFilter.branch_id)
      .is("invalidated_at_turn_id", null),
    supabase
      .from("world_relationships")
      .select("*")
      .eq("thread_id", baseFilter.thread_id)
      .eq("branch_id", baseFilter.branch_id)
      .is("invalidated_at_turn_id", null),
    supabase
      .from("world_locations")
      .select("*")
      .eq("thread_id", baseFilter.thread_id)
      .eq("branch_id", baseFilter.branch_id)
      .is("invalidated_at_turn_id", null),
    supabase
      .from("world_location_edges")
      .select("*")
      .eq("thread_id", baseFilter.thread_id)
      .eq("branch_id", baseFilter.branch_id)
      .is("invalidated_at_turn_id", null),
    supabase
      .from("world_entity_placements")
      .select("*")
      .eq("thread_id", baseFilter.thread_id)
      .eq("branch_id", baseFilter.branch_id)
      .is("invalidated_at_turn_id", null),
    supabase
      .from("world_narrative_threads")
      .select("*")
      .eq("thread_id", baseFilter.thread_id)
      .eq("branch_id", baseFilter.branch_id)
      .is("invalidated_at_turn_id", null),
  ]);

  const firstError = entitiesErr ?? factsErr ?? relsErr ?? locsErr ?? edgesErr ?? placementsErr ?? narrativeErr;
  if (firstError) {
    throw firstError;
  }

  return {
    entities: (entities ?? []) as WorldEntityRecord[],
    facts: (facts ?? []) as WorldEntityFactRecord[],
    relationships: (relationships ?? []) as WorldRelationshipRecord[],
    locations: (locations ?? []) as WorldLocationRecord[],
    edges: (edges ?? []) as WorldLocationEdgeRecord[],
    placements: (placements ?? []) as WorldEntityPlacementRecord[],
    narrativeThreads: (narrativeThreads ?? []) as WorldNarrativeThreadRecord[],
  };
}

function buildSpatialState(
  state: ActiveWorldState,
): DurableMemorySnapshot["spatial_state"] {
  const locationMap = new Map(state.locations.map((l) => [l.id, l]));
  const entityMap = new Map(state.entities.map((e) => [e.id, e]));

  const userEntity = state.entities.find(
    (e) => e.entity_type === "character" && e.character_id !== null,
  );

  const userPlacement = userEntity
    ? state.placements.find((p) => p.entity_id === userEntity.id)
    : undefined;

  const currentLocation = userPlacement
    ? locationMap.get(userPlacement.location_id) ?? null
    : null;

  let adjacentLocations: DurableMemorySnapshot["spatial_state"]["adjacent_locations"] = [];

  if (currentLocation) {
    const adjacentIds = new Set<string>();

    for (const edge of state.edges) {
      if (edge.from_location_id === currentLocation.id) {
        adjacentIds.add(edge.to_location_id);
      }
      if (edge.is_bidirectional && edge.to_location_id === currentLocation.id) {
        adjacentIds.add(edge.from_location_id);
      }
    }

    adjacentLocations = [...adjacentIds]
      .map((id) => locationMap.get(id))
      .filter((loc): loc is WorldLocationRecord => loc !== undefined)
      .map((loc) => ({ id: loc.id, name: loc.canonical_name }));
  }

  const knownLocations = state.locations.map((loc) => ({
    id: loc.id,
    name: loc.canonical_name,
    description: loc.description,
    environmental_modifiers: loc.environmental_modifiers,
  }));

  const edges = state.edges.map((edge) => ({
    edge_id: edge.id,
    from_location_id: edge.from_location_id,
    to_location_id: edge.to_location_id,
    is_bidirectional: edge.is_bidirectional,
  }));

  const entityPlacements = state.placements.map((p) => {
    const entity = entityMap.get(p.entity_id);
    const location = locationMap.get(p.location_id);
    return {
      entity_id: p.entity_id,
      entity_name: entity?.canonical_name ?? "",
      location_id: p.location_id,
      location_name: location?.canonical_name ?? "",
      micro_position: p.micro_position,
    };
  });

  return {
    current_location: currentLocation
      ? {
          id: currentLocation.id,
          name: currentLocation.canonical_name,
          description: currentLocation.description,
          environmental_modifiers: currentLocation.environmental_modifiers,
        }
      : null,
    adjacent_locations: adjacentLocations,
    known_locations: knownLocations,
    edges,
    entity_placements: entityPlacements,
  };
}

function buildEntityState(
  state: ActiveWorldState,
): DurableMemorySnapshot["entity_state"] {
  const factsByEntity = new Map<string, WorldEntityFactRecord[]>();
  for (const fact of state.facts) {
    const existing = factsByEntity.get(fact.entity_id) ?? [];
    existing.push(fact);
    factsByEntity.set(fact.entity_id, existing);
  }

  return state.entities.map((entity) => {
    const entityFacts = factsByEntity.get(entity.id) ?? [];

    const byType = (type: FactType) =>
      entityFacts.filter((f) => f.fact_type === type).map((f) => ({ id: f.id, body: f.body }));

    return {
      entity_id: entity.id,
      canonical_name: entity.canonical_name,
      entity_type: entity.entity_type,
      aliases: entity.aliases,
      is_present: entity.is_present,
      primary_emotion: entity.primary_emotion,
      emotion_intensity: entity.emotion_intensity,
      emotion_catalyst: entity.emotion_catalyst,
      knowledge_boundary: byType("knowledge"),
      traits: byType("trait"),
      goals: byType("goal"),
      secrets: byType("secret"),
      abilities: byType("ability"),
      possessions: byType("possession"),
    };
  });
}

function buildRelationalState(
  state: ActiveWorldState,
): DurableMemorySnapshot["relational_state"] {
  const entityMap = new Map(state.entities.map((e) => [e.id, e]));

  return state.relationships.map((rel) => ({
    relationship_id: rel.id,
    source_entity_id: rel.source_entity_id,
    source_entity_name: entityMap.get(rel.source_entity_id)?.canonical_name ?? "",
    target_entity_id: rel.target_entity_id,
    target_entity_name: entityMap.get(rel.target_entity_id)?.canonical_name ?? "",
    relationship_type: rel.relationship_type,
    dynamic_status: rel.dynamic_status,
  }));
}

function buildNarrativeState(
  state: ActiveWorldState,
  snapshotRecord: WorldSnapshotRecord | null,
): DurableMemorySnapshot["narrative_state"] {
  const activeThreads = state.narrativeThreads
    .filter((nt) => nt.status !== "resolved")
    .map((nt) => ({
      thread_id: nt.id,
      objective: nt.objective,
      status: nt.status,
      dependencies: nt.dependency_ids,
    }));

  const resolvedThreads = state.narrativeThreads
    .filter((nt) => nt.status === "resolved")
    .map((nt) => nt.objective);

  return {
    story_summary: snapshotRecord?.story_summary ?? "",
    scene_summary: snapshotRecord?.scene_summary ?? "",
    last_turn_beat: snapshotRecord?.last_turn_beat ?? "",
    active_threads: activeThreads,
    resolved_threads: resolvedThreads,
  };
}

export async function materializeDurableSnapshot(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
  turnId: string,
  snapshotRecord: WorldSnapshotRecord | null,
): Promise<DurableMemorySnapshot> {
  const state = await fetchActiveWorldState(supabase, threadId, branchId);

  return {
    metadata: {
      current_turn_id: turnId,
      narrative_timestamp: snapshotRecord?.narrative_timestamp ?? "",
      transition_type: snapshotRecord?.transition_type ?? "continuation",
      version: snapshotRecord?.version ?? 1,
    },
    spatial_state: buildSpatialState(state),
    entity_state: buildEntityState(state),
    relational_state: buildRelationalState(state),
    narrative_state: buildNarrativeState(state, snapshotRecord),
  };
}

export function buildEmptyDurableSnapshot(turnId: string): DurableMemorySnapshot {
  return {
    metadata: {
      current_turn_id: turnId,
      narrative_timestamp: "",
      transition_type: "continuation",
      version: 1,
    },
    spatial_state: {
      current_location: null,
      adjacent_locations: [],
      known_locations: [],
      edges: [],
      entity_placements: [],
    },
    entity_state: [],
    relational_state: [],
    narrative_state: {
      story_summary: "",
      scene_summary: "",
      last_turn_beat: "",
      active_threads: [],
      resolved_threads: [],
    },
  };
}
