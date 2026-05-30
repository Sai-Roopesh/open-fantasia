import { describe, expect, it } from "vitest";
import { applyExtractionToSnapshot } from "@/lib/domain/world-state-reducer";
import { buildEmptyDurableSnapshot } from "@/lib/domain/world-snapshot";
import type { ExtractionOutput } from "@/lib/ai/state-extraction";

function emptyExtraction(overrides: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    transition_type: "continuation",
    story_summary: "",
    scene_summary: "",
    last_turn_beat: "",
    narrative_timestamp: "",
    entity_mutations: [],
    fact_mutations: [],
    relationship_mutations: [],
    location_mutations: [],
    location_edge_mutations: [],
    placement_mutations: [],
    narrative_thread_mutations: [],
    timeline_events: [],
    ...overrides,
  };
}

/** Deterministic id generator so assertions are stable. */
function seqIds() {
  let n = 0;
  return () => `id-${++n}`;
}

describe("world-state reducer", () => {
  it("adds a new entity and resolves NEW: refs for its facts and placement", () => {
    const previous = buildEmptyDurableSnapshot("turn-0");
    const extraction = emptyExtraction({
      story_summary: "A story.",
      scene_summary: "A scene.",
      last_turn_beat: "It began.",
      entity_mutations: [
        { op: "add", canonical_name: "Ananya", entity_type: "character", primary_emotion: "determined", emotion_intensity: 7 },
      ],
      fact_mutations: [
        { op: "add", entity_id: "NEW:Ananya", fact_type: "goal", body: "Win the challenge" },
      ],
      location_mutations: [{ op: "add", canonical_name: "AIIMS", description: "A hospital" }],
      placement_mutations: [
        { op: "move", entity_id: "NEW:Ananya", to_location_id: "NEW:AIIMS", micro_position: "ward" },
      ],
    });

    const { snapshot } = applyExtractionToSnapshot({
      previous,
      extraction,
      turnId: "turn-1",
      newId: seqIds(),
    });

    expect(snapshot.entity_state).toHaveLength(1);
    const ananya = snapshot.entity_state[0];
    expect(ananya.canonical_name).toBe("Ananya");
    expect(ananya.primary_emotion).toBe("determined");
    expect(ananya.goals).toEqual([{ id: expect.any(String), body: "Win the challenge" }]);

    // Placement resolved both NEW: refs to the generated ids; POV-derived
    // current_location reflects the character's placement.
    expect(snapshot.spatial_state.current_location?.name).toBe("AIIMS");
    expect(snapshot.spatial_state.entity_placements[0]).toMatchObject({
      entity_name: "Ananya",
      location_name: "AIIMS",
      micro_position: "ward",
    });

    // Summaries + version advanced.
    expect(snapshot.narrative_state.story_summary).toBe("A story.");
    expect(snapshot.metadata.version).toBe(2);
    expect(snapshot.metadata.current_turn_id).toBe("turn-1");
  });

  it("does not mutate the previous snapshot (pure)", () => {
    const previous = buildEmptyDurableSnapshot("turn-0");
    applyExtractionToSnapshot({
      previous,
      extraction: emptyExtraction({
        entity_mutations: [{ op: "add", canonical_name: "X", entity_type: "npc" }],
      }),
      turnId: "turn-1",
      newId: seqIds(),
    });
    expect(previous.entity_state).toHaveLength(0);
    expect(previous.metadata.version).toBe(1);
  });

  it("invalidating an entity drops its relationships and placements", () => {
    const previous = buildEmptyDurableSnapshot("turn-0");
    const seeded = applyExtractionToSnapshot({
      previous,
      extraction: emptyExtraction({
        entity_mutations: [
          { op: "add", canonical_name: "A", entity_type: "character" },
          { op: "add", canonical_name: "B", entity_type: "npc" },
        ],
      }),
      turnId: "turn-1",
      newId: seqIds(),
    });
    const a = seeded.snapshot.entity_state.find((e) => e.canonical_name === "A")!;
    const b = seeded.snapshot.entity_state.find((e) => e.canonical_name === "B")!;

    const withRel = applyExtractionToSnapshot({
      previous: seeded.snapshot,
      extraction: emptyExtraction({
        relationship_mutations: [
          { op: "add", source_entity_id: a.entity_id, target_entity_id: b.entity_id, relationship_type: "adversarial", dynamic_status: "rivals" },
        ],
      }),
      turnId: "turn-2",
      newId: seqIds(),
    });
    expect(withRel.snapshot.relational_state).toHaveLength(1);

    const afterInvalidate = applyExtractionToSnapshot({
      previous: withRel.snapshot,
      extraction: emptyExtraction({ entity_mutations: [{ op: "invalidate", entity_id: b.entity_id }] }),
      turnId: "turn-3",
      newId: seqIds(),
    });
    expect(afterInvalidate.snapshot.entity_state.map((e) => e.canonical_name)).toEqual(["A"]);
    expect(afterInvalidate.snapshot.relational_state).toHaveLength(0);
  });

  it("resolves a narrative thread by moving it to resolved_threads", () => {
    const previous = buildEmptyDurableSnapshot("turn-0");
    const opened = applyExtractionToSnapshot({
      previous,
      extraction: emptyExtraction({
        narrative_thread_mutations: [{ op: "add", objective: "Diagnose the diplomat" }],
      }),
      turnId: "turn-1",
      newId: seqIds(),
    });
    const threadId = opened.snapshot.narrative_state.active_threads[0].thread_id;

    const resolved = applyExtractionToSnapshot({
      previous: opened.snapshot,
      extraction: emptyExtraction({
        narrative_thread_mutations: [{ op: "resolve", thread_id: threadId }],
      }),
      turnId: "turn-2",
      newId: seqIds(),
    });
    expect(resolved.snapshot.narrative_state.active_threads).toHaveLength(0);
    expect(resolved.snapshot.narrative_state.resolved_threads).toEqual(["Diagnose the diplomat"]);
  });
});
