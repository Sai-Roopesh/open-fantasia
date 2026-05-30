import type { DurableMemorySnapshot, WorldSnapshotRecord } from "@/lib/types";

/**
 * The neutral starting world state for a branch with no prior snapshot.
 */
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

/**
 * Reads the durable snapshot out of a world_snapshots row. With JSONB storage
 * this is a pure accessor — the row already holds the full snapshot. Falls back
 * to an empty snapshot if the blob is missing or malformed (e.g. a legacy row
 * predating the backfill).
 */
export function parseWorldSnapshot(record: WorldSnapshotRecord): DurableMemorySnapshot {
  const ws = record.world_state as DurableMemorySnapshot | null | undefined;
  if (ws && typeof ws === "object" && "metadata" in ws && "entity_state" in ws) {
    return ws;
  }
  return buildEmptyDurableSnapshot(record.turn_id);
}
