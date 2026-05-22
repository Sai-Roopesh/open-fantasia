import { describe, expect, it } from "vitest";
import { buildEmptyDurableSnapshot } from "@/lib/ai/state-materializer";

describe("HCE continuity", () => {
  it("builds an empty durable snapshot with correct defaults", () => {
    const snapshot = buildEmptyDurableSnapshot("turn-0");

    expect(snapshot.metadata.version).toBe(1);
    expect(snapshot.metadata.current_turn_id).toBe("turn-0");
    expect(snapshot.metadata.transition_type).toBe("continuation");
    expect(snapshot.narrative_state.story_summary).toBe("");
    expect(snapshot.narrative_state.scene_summary).toBe("");
    expect(snapshot.narrative_state.last_turn_beat).toBe("");
    expect(snapshot.entity_state).toEqual([]);
    expect(snapshot.relational_state).toEqual([]);
    expect(snapshot.narrative_state.active_threads).toEqual([]);
    expect(snapshot.narrative_state.resolved_threads).toEqual([]);
    expect(snapshot.spatial_state.current_location).toBeNull();
    expect(snapshot.spatial_state.adjacent_locations).toEqual([]);
    expect(snapshot.spatial_state.entity_placements).toEqual([]);
  });
});
