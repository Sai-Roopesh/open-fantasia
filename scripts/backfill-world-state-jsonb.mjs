/**
 * Backfill world_snapshots.world_state (JSONB) from the legacy normalized
 * world_* tables. Mirrors the assembly previously done by
 * src/lib/ai/state-materializer.ts::materializeDurableSnapshot so the JSONB blob
 * is byte-for-byte the snapshot the app would have produced. Idempotent: safe to
 * re-run; it overwrites world_state for every snapshot row.
 *
 * Run AFTER migration 0005 and BEFORE 0007 (which drops the normalized tables).
 *
 *   SUPABASE from .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *   node scripts/backfill-world-state-jsonb.mjs
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const active = (q) => q.is("invalidated_at_turn_id", null);

async function fetchActiveWorldState(threadId, branchId) {
  const base = (t) =>
    active(sb.from(t).select("*").eq("thread_id", threadId).eq("branch_id", branchId));
  const [entities, facts, relationships, locations, edges, placements, narrativeThreads] =
    await Promise.all([
      base("world_entities"),
      base("world_entity_facts"),
      base("world_relationships"),
      base("world_locations"),
      base("world_location_edges"),
      base("world_entity_placements"),
      base("world_narrative_threads"),
    ]);
  for (const r of [entities, facts, relationships, locations, edges, placements, narrativeThreads]) {
    if (r.error) throw r.error;
  }
  return {
    entities: entities.data ?? [],
    facts: facts.data ?? [],
    relationships: relationships.data ?? [],
    locations: locations.data ?? [],
    edges: edges.data ?? [],
    placements: placements.data ?? [],
    narrativeThreads: narrativeThreads.data ?? [],
  };
}

function buildSpatialState(s) {
  const locationMap = new Map(s.locations.map((l) => [l.id, l]));
  const entityMap = new Map(s.entities.map((e) => [e.id, e]));
  const userEntity = s.entities.find((e) => e.entity_type === "character" && e.character_id !== null);
  const userPlacement = userEntity ? s.placements.find((p) => p.entity_id === userEntity.id) : undefined;
  const currentLocation = userPlacement ? locationMap.get(userPlacement.location_id) ?? null : null;

  let adjacent_locations = [];
  if (currentLocation) {
    const adjacentIds = new Set();
    for (const edge of s.edges) {
      if (edge.from_location_id === currentLocation.id) adjacentIds.add(edge.to_location_id);
      if (edge.is_bidirectional && edge.to_location_id === currentLocation.id)
        adjacentIds.add(edge.from_location_id);
    }
    adjacent_locations = [...adjacentIds]
      .map((id) => locationMap.get(id))
      .filter(Boolean)
      .map((loc) => ({ id: loc.id, name: loc.canonical_name }));
  }

  return {
    current_location: currentLocation
      ? {
          id: currentLocation.id,
          name: currentLocation.canonical_name,
          description: currentLocation.description,
          environmental_modifiers: currentLocation.environmental_modifiers,
        }
      : null,
    adjacent_locations,
    known_locations: s.locations.map((loc) => ({
      id: loc.id,
      name: loc.canonical_name,
      description: loc.description,
      environmental_modifiers: loc.environmental_modifiers,
    })),
    edges: s.edges.map((edge) => ({
      edge_id: edge.id,
      from_location_id: edge.from_location_id,
      to_location_id: edge.to_location_id,
      is_bidirectional: edge.is_bidirectional,
    })),
    entity_placements: s.placements.map((p) => ({
      entity_id: p.entity_id,
      entity_name: entityMap.get(p.entity_id)?.canonical_name ?? "",
      location_id: p.location_id,
      location_name: locationMap.get(p.location_id)?.canonical_name ?? "",
      micro_position: p.micro_position,
    })),
  };
}

function buildEntityState(s) {
  const factsByEntity = new Map();
  for (const fact of s.facts) {
    const arr = factsByEntity.get(fact.entity_id) ?? [];
    arr.push(fact);
    factsByEntity.set(fact.entity_id, arr);
  }
  return s.entities.map((entity) => {
    const entityFacts = factsByEntity.get(entity.id) ?? [];
    const byType = (type) =>
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

function buildRelationalState(s) {
  const entityMap = new Map(s.entities.map((e) => [e.id, e]));
  return s.relationships.map((rel) => ({
    relationship_id: rel.id,
    source_entity_id: rel.source_entity_id,
    source_entity_name: entityMap.get(rel.source_entity_id)?.canonical_name ?? "",
    target_entity_id: rel.target_entity_id,
    target_entity_name: entityMap.get(rel.target_entity_id)?.canonical_name ?? "",
    relationship_type: rel.relationship_type,
    dynamic_status: rel.dynamic_status,
  }));
}

function buildNarrativeState(s, snap) {
  return {
    story_summary: snap.story_summary ?? "",
    scene_summary: snap.scene_summary ?? "",
    last_turn_beat: snap.last_turn_beat ?? "",
    active_threads: s.narrativeThreads
      .filter((nt) => nt.status !== "resolved")
      .map((nt) => ({
        thread_id: nt.id,
        objective: nt.objective,
        status: nt.status,
        dependencies: nt.dependency_ids,
      })),
    resolved_threads: s.narrativeThreads
      .filter((nt) => nt.status === "resolved")
      .map((nt) => nt.objective),
  };
}

const { data: snapshots, error } = await sb.from("world_snapshots").select("*");
if (error) throw error;

console.log(`Backfilling ${snapshots.length} snapshots...`);
let ok = 0;
for (const snap of snapshots) {
  const state = await fetchActiveWorldState(snap.thread_id, snap.branch_id);
  const world_state = {
    metadata: {
      current_turn_id: snap.turn_id,
      narrative_timestamp: snap.narrative_timestamp ?? "",
      transition_type: snap.transition_type ?? "continuation",
      version: snap.version ?? 1,
    },
    spatial_state: buildSpatialState(state),
    entity_state: buildEntityState(state),
    relational_state: buildRelationalState(state),
    narrative_state: buildNarrativeState(state, snap),
  };
  const { error: upErr } = await sb
    .from("world_snapshots")
    .update({ world_state })
    .eq("turn_id", snap.turn_id);
  if (upErr) {
    console.error(`  FAILED ${snap.turn_id}:`, upErr.message);
  } else {
    ok++;
  }
}
console.log(`Done. ${ok}/${snapshots.length} backfilled.`);
