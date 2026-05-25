import type { DatabaseClient } from "@/lib/data/shared";
import type {
  WorldSnapshotRecord,
  WorldEntityRecord,
  WorldEntityFactRecord,
  WorldRelationshipRecord,
  WorldLocationRecord,
  WorldLocationEdgeRecord,
  WorldEntityPlacementRecord,
  WorldNarrativeThreadRecord,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// world_snapshots
// ---------------------------------------------------------------------------

export async function getWorldSnapshot(
  supabase: DatabaseClient,
  turnId: string,
): Promise<WorldSnapshotRecord | null> {
  const { data, error } = await supabase
    .from("world_snapshots")
    .select("*")
    .eq("turn_id", turnId)
    .maybeSingle();

  if (error) throw error;
  return (data as WorldSnapshotRecord) ?? null;
}

export async function listWorldSnapshots(
  supabase: DatabaseClient,
  threadId: string,
): Promise<WorldSnapshotRecord[]> {
  const { data, error } = await supabase
    .from("world_snapshots")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorldSnapshotRecord[];
}

export async function saveWorldSnapshot(
  supabase: DatabaseClient,
  snapshot: WorldSnapshotRecord,
) {
  const { error } = await supabase
    .from("world_snapshots")
    .upsert(snapshot, { onConflict: "turn_id" });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// world_entities
// ---------------------------------------------------------------------------

export async function getActiveEntities(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<WorldEntityRecord[]> {
  const { data, error } = await supabase
    .from("world_entities")
    .select("*")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .is("invalidated_at_turn_id", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorldEntityRecord[];
}

export async function insertEntity(
  supabase: DatabaseClient,
  entity: Omit<WorldEntityRecord, "id" | "character_id" | "invalidated_at_turn_id" | "t_created" | "t_expired" | "created_at" | "updated_at">,
): Promise<{ id: string }> {
  const { data, error } = await supabase.from("world_entities").insert(entity).select("id").single();
  if (error) throw error;
  return data;
}

export async function invalidateEntity(
  supabase: DatabaseClient,
  entityId: string,
  turnId: string,
) {
  const { error } = await supabase
    .from("world_entities")
    .update({ invalidated_at_turn_id: turnId, t_expired: new Date().toISOString() })
    .eq("id", entityId);

  if (error) throw error;
}

export async function updateEntity(
  supabase: DatabaseClient,
  entityId: string,
  changes: Partial<
    Pick<
      WorldEntityRecord,
      | "is_present"
      | "primary_emotion"
      | "emotion_intensity"
      | "emotion_catalyst"
      | "aliases"
    >
  >,
) {
  const { error } = await supabase
    .from("world_entities")
    .update(changes)
    .eq("id", entityId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// world_entity_facts
// ---------------------------------------------------------------------------

export async function getActiveEntityFacts(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<WorldEntityFactRecord[]> {
  const { data, error } = await supabase
    .from("world_entity_facts")
    .select("*")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .is("invalidated_at_turn_id", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorldEntityFactRecord[];
}

export async function insertEntityFact(
  supabase: DatabaseClient,
  fact: Omit<WorldEntityFactRecord, "id" | "invalidated_at_turn_id" | "t_created" | "t_expired" | "created_at">,
) {
  const { error } = await supabase.from("world_entity_facts").insert(fact);
  if (error) throw error;
}

export async function invalidateEntityFact(
  supabase: DatabaseClient,
  factId: string,
  turnId: string,
) {
  const { error } = await supabase
    .from("world_entity_facts")
    .update({ invalidated_at_turn_id: turnId, t_expired: new Date().toISOString() })
    .eq("id", factId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// world_relationships
// ---------------------------------------------------------------------------

export async function getActiveRelationships(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<WorldRelationshipRecord[]> {
  const { data, error } = await supabase
    .from("world_relationships")
    .select("*")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .is("invalidated_at_turn_id", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorldRelationshipRecord[];
}

export async function insertRelationship(
  supabase: DatabaseClient,
  relationship: Omit<WorldRelationshipRecord, "id" | "invalidated_at_turn_id" | "t_created" | "t_expired" | "created_at">,
) {
  const { error } = await supabase
    .from("world_relationships")
    .insert(relationship);
  if (error) throw error;
}

export async function invalidateRelationship(
  supabase: DatabaseClient,
  relationshipId: string,
  turnId: string,
) {
  const { error } = await supabase
    .from("world_relationships")
    .update({ invalidated_at_turn_id: turnId, t_expired: new Date().toISOString() })
    .eq("id", relationshipId);

  if (error) throw error;
}

export async function updateRelationship(
  supabase: DatabaseClient,
  relationshipId: string,
  changes: Partial<Pick<WorldRelationshipRecord, "dynamic_status">>,
) {
  const { error } = await supabase
    .from("world_relationships")
    .update(changes)
    .eq("id", relationshipId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// world_locations
// ---------------------------------------------------------------------------

export async function getActiveLocations(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<WorldLocationRecord[]> {
  const { data, error } = await supabase
    .from("world_locations")
    .select("*")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .is("invalidated_at_turn_id", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorldLocationRecord[];
}

export async function insertLocation(
  supabase: DatabaseClient,
  location: Omit<WorldLocationRecord, "id" | "invalidated_at_turn_id" | "t_created" | "t_expired" | "created_at">,
): Promise<{ id: string }> {
  const { data, error } = await supabase.from("world_locations").insert(location).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateLocation(
  supabase: DatabaseClient,
  locationId: string,
  changes: Partial<
    Pick<WorldLocationRecord, "description" | "environmental_modifiers">
  >,
) {
  const { error } = await supabase
    .from("world_locations")
    .update(changes)
    .eq("id", locationId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// world_location_edges
// ---------------------------------------------------------------------------

export async function getActiveLocationEdges(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<WorldLocationEdgeRecord[]> {
  const { data, error } = await supabase
    .from("world_location_edges")
    .select("*")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .is("invalidated_at_turn_id", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorldLocationEdgeRecord[];
}

export async function insertLocationEdge(
  supabase: DatabaseClient,
  edge: Omit<WorldLocationEdgeRecord, "id" | "invalidated_at_turn_id" | "t_created" | "t_expired" | "created_at">,
) {
  const { error } = await supabase.from("world_location_edges").insert(edge);
  if (error) throw error;
}

export async function invalidateLocationEdge(
  supabase: DatabaseClient,
  edgeId: string,
  turnId: string,
) {
  const { error } = await supabase
    .from("world_location_edges")
    .update({ invalidated_at_turn_id: turnId, t_expired: new Date().toISOString() })
    .eq("id", edgeId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// world_entity_placements
// ---------------------------------------------------------------------------

export async function getActiveEntityPlacements(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<WorldEntityPlacementRecord[]> {
  const { data, error } = await supabase
    .from("world_entity_placements")
    .select("*")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .is("invalidated_at_turn_id", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorldEntityPlacementRecord[];
}

export async function insertEntityPlacement(
  supabase: DatabaseClient,
  placement: Omit<WorldEntityPlacementRecord, "id" | "invalidated_at_turn_id" | "t_created" | "t_expired" | "created_at">,
) {
  const { error } = await supabase
    .from("world_entity_placements")
    .insert(placement);
  if (error) throw error;
}

export async function invalidateEntityPlacement(
  supabase: DatabaseClient,
  entityId: string,
  turnId: string,
) {
  const { error } = await supabase
    .from("world_entity_placements")
    .update({ invalidated_at_turn_id: turnId, t_expired: new Date().toISOString() })
    .eq("entity_id", entityId)
    .is("invalidated_at_turn_id", null);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// world_narrative_threads
// ---------------------------------------------------------------------------

export async function getActiveNarrativeThreads(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
): Promise<WorldNarrativeThreadRecord[]> {
  const { data, error } = await supabase
    .from("world_narrative_threads")
    .select("*")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .is("invalidated_at_turn_id", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorldNarrativeThreadRecord[];
}

export async function insertNarrativeThread(
  supabase: DatabaseClient,
  narrativeThread: Omit<WorldNarrativeThreadRecord, "id" | "invalidated_at_turn_id" | "t_created" | "t_expired" | "created_at">,
) {
  const { error } = await supabase
    .from("world_narrative_threads")
    .insert(narrativeThread);
  if (error) throw error;
}

export async function updateNarrativeThread(
  supabase: DatabaseClient,
  narrativeThreadId: string,
  changes: Partial<Pick<WorldNarrativeThreadRecord, "status" | "objective">>,
) {
  const { error } = await supabase
    .from("world_narrative_threads")
    .update(changes)
    .eq("id", narrativeThreadId);

  if (error) throw error;
}

export async function invalidateNarrativeThread(
  supabase: DatabaseClient,
  narrativeThreadId: string,
  turnId: string,
) {
  const { error } = await supabase
    .from("world_narrative_threads")
    .update({ invalidated_at_turn_id: turnId, t_expired: new Date().toISOString() })
    .eq("id", narrativeThreadId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Copy-on-branch: deep copy all active world state to a new branch
// ---------------------------------------------------------------------------

export async function copyWorldStateToBranch(
  supabase: DatabaseClient,
  threadId: string,
  sourceBranchId: string,
  targetBranchId: string,
) {
  const [
    entities,
    facts,
    relationships,
    locations,
    edges,
    placements,
    narrativeThreads,
  ] = await Promise.all([
    getActiveEntities(supabase, threadId, sourceBranchId),
    getActiveEntityFacts(supabase, threadId, sourceBranchId),
    getActiveRelationships(supabase, threadId, sourceBranchId),
    getActiveLocations(supabase, threadId, sourceBranchId),
    getActiveLocationEdges(supabase, threadId, sourceBranchId),
    getActiveEntityPlacements(supabase, threadId, sourceBranchId),
    getActiveNarrativeThreads(supabase, threadId, sourceBranchId),
  ]);

  const entityIdMap = new Map<string, string>();
  for (const e of entities) {
    entityIdMap.set(e.id, crypto.randomUUID());
  }

  const locationIdMap = new Map<string, string>();
  for (const l of locations) {
    locationIdMap.set(l.id, crypto.randomUUID());
  }

  const narrativeIdMap = new Map<string, string>();
  for (const n of narrativeThreads) {
    narrativeIdMap.set(n.id, crypto.randomUUID());
  }

  if (entities.length > 0) {
    const rows = entities.map((e) => ({
      id: entityIdMap.get(e.id)!,
      thread_id: threadId,
      branch_id: targetBranchId,
      canonical_name: e.canonical_name,
      entity_type: e.entity_type,
      aliases: e.aliases,
      character_id: e.character_id,
      is_present: e.is_present,
      primary_emotion: e.primary_emotion,
      emotion_intensity: e.emotion_intensity,
      emotion_catalyst: e.emotion_catalyst,
      valid_from_turn_id: e.valid_from_turn_id,
      invalidated_at_turn_id: null,
      t_created: e.t_created,
      t_expired: null,
    }));
    const { error } = await supabase.from("world_entities").insert(rows);
    if (error) throw error;
  }

  if (facts.length > 0) {
    const rows = facts.map((f) => ({
      id: crypto.randomUUID(),
      entity_id: entityIdMap.get(f.entity_id) ?? f.entity_id,
      thread_id: threadId,
      branch_id: targetBranchId,
      fact_type: f.fact_type,
      body: f.body,
      valid_from_turn_id: f.valid_from_turn_id,
      invalidated_at_turn_id: null,
      t_created: f.t_created,
      t_expired: null,
    }));
    const { error } = await supabase.from("world_entity_facts").insert(rows);
    if (error) throw error;
  }

  if (relationships.length > 0) {
    const rows = relationships.map((r) => ({
      id: crypto.randomUUID(),
      thread_id: threadId,
      branch_id: targetBranchId,
      source_entity_id:
        entityIdMap.get(r.source_entity_id) ?? r.source_entity_id,
      target_entity_id:
        entityIdMap.get(r.target_entity_id) ?? r.target_entity_id,
      relationship_type: r.relationship_type,
      dynamic_status: r.dynamic_status,
      valid_from_turn_id: r.valid_from_turn_id,
      invalidated_at_turn_id: null,
      t_created: r.t_created,
      t_expired: null,
    }));
    const { error } = await supabase.from("world_relationships").insert(rows);
    if (error) throw error;
  }

  if (locations.length > 0) {
    const rows = locations.map((l) => ({
      id: locationIdMap.get(l.id)!,
      thread_id: threadId,
      branch_id: targetBranchId,
      canonical_name: l.canonical_name,
      description: l.description,
      environmental_modifiers: l.environmental_modifiers,
      valid_from_turn_id: l.valid_from_turn_id,
      invalidated_at_turn_id: null,
      t_created: l.t_created,
      t_expired: null,
    }));
    const { error } = await supabase.from("world_locations").insert(rows);
    if (error) throw error;
  }

  if (edges.length > 0) {
    const rows = edges.map((e) => ({
      id: crypto.randomUUID(),
      thread_id: threadId,
      branch_id: targetBranchId,
      from_location_id:
        locationIdMap.get(e.from_location_id) ?? e.from_location_id,
      to_location_id:
        locationIdMap.get(e.to_location_id) ?? e.to_location_id,
      is_bidirectional: e.is_bidirectional,
      valid_from_turn_id: e.valid_from_turn_id,
      invalidated_at_turn_id: null,
      t_created: e.t_created,
      t_expired: null,
    }));
    const { error } = await supabase.from("world_location_edges").insert(rows);
    if (error) throw error;
  }

  if (placements.length > 0) {
    const rows = placements.map((p) => ({
      id: crypto.randomUUID(),
      thread_id: threadId,
      branch_id: targetBranchId,
      entity_id: entityIdMap.get(p.entity_id) ?? p.entity_id,
      location_id: locationIdMap.get(p.location_id) ?? p.location_id,
      micro_position: p.micro_position,
      valid_from_turn_id: p.valid_from_turn_id,
      invalidated_at_turn_id: null,
      t_created: p.t_created,
      t_expired: null,
    }));
    const { error } = await supabase
      .from("world_entity_placements")
      .insert(rows);
    if (error) throw error;
  }

  if (narrativeThreads.length > 0) {
    const rows = narrativeThreads.map((n) => ({
      id: narrativeIdMap.get(n.id)!,
      thread_id: threadId,
      branch_id: targetBranchId,
      objective: n.objective,
      status: n.status,
      dependency_ids: n.dependency_ids.map(
        (depId) => narrativeIdMap.get(depId) ?? depId,
      ),
      valid_from_turn_id: n.valid_from_turn_id,
      invalidated_at_turn_id: null,
      t_created: n.t_created,
      t_expired: null,
    }));
    const { error } = await supabase
      .from("world_narrative_threads")
      .insert(rows);
    if (error) throw error;
  }
}
