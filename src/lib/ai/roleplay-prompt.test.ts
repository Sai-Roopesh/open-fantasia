import { describe, expect, it } from "vitest";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import type { CharacterBundle } from "@/lib/data/characters";
import type { DurableMemorySnapshot, TimelineEventRecord, UserPersonaRecord } from "@/lib/types";

const mockCharacter: CharacterBundle = {
  character: {
    id: "char_1",
    user_id: "user_1",
    name: "Alex",
    story: "A salvaged shipyard orbiting a dead moon. A broken down spaceship needs repair.",
    core_persona: "Gruff but kind",
    greeting: "Hey there.",
    appearance: "Lean mechanic with oil-streaked hands and a weathered jacket",
    style_rules: "Use slang",
    definition: "An expert",
    negative_guidance: "Do not flirt",
    starters: [],
    example_conversations: [],
    portrait_status: "idle",
    portrait_path: "",
    portrait_prompt: "",
    portrait_seed: null,
    portrait_source_hash: "",
    portrait_last_error: "",
    portrait_generated_at: null,
    temperature: 0.9,
    top_p: 0.9,
    max_output_tokens: 500,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  starters: [],
  exampleConversations: [],
};

const mockPersona: UserPersonaRecord = {
  id: "persona_1",
  user_id: "user_1",
  name: "Riley",
  identity: "Space pilot",
  backstory: "Lost a ship",
  voice_style: "Anxious",
  goals: "Find a new ship",
  boundaries: "No physical contact",
  private_notes: "",
  is_default: false,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

function makeTimelineEvent(overrides: Partial<TimelineEventRecord> & Pick<TimelineEventRecord, "id" | "title" | "detail" | "importance">): TimelineEventRecord {
  return {
    thread_id: "t1",
    branch_id: "b1",
    turn_id: "turn_1",
    event_type: "beat",
    affected_entity_ids: [],
    affected_relationship_ids: [],
    created_at: "",
    ...overrides,
  };
}

describe("buildRoleplaySystemPrompt", () => {
  it("includes tagged sections for the HCE prompt", () => {
    const prompt = buildRoleplaySystemPrompt({
      character: mockCharacter,
      persona: mockPersona,
      snapshot: null,
      pins: [],
      timeline: [],
    });

    expect(prompt).toContain("<role_objective>");
    expect(prompt).toContain("You are roleplaying as Alex.");
    expect(prompt).toContain("<story_setting>");
    expect(prompt).toContain("<character_persona>");
    expect(prompt).toContain("<durable_state>");
    expect(prompt).toContain("No world state has been materialized yet.");
    expect(prompt).toContain("<response_contract>");
    expect(prompt).toContain("Advance the plot by one concrete beat");
    expect(prompt).not.toContain("Hey there.");
  });

  it("omits the story section when story is empty", () => {
    const emptyStoryChar = {
      ...mockCharacter,
      character: { ...mockCharacter.character, story: "" },
    };
    const prompt = buildRoleplaySystemPrompt({
      character: emptyStoryChar,
      persona: mockPersona,
      snapshot: null,
      pins: [],
      timeline: [],
    });

    expect(prompt).not.toContain("<story_setting>");
    expect(prompt).toContain("<character_persona>");
  });

  it("includes pre-filtered timeline events in the prompt", () => {
    // toPromptTimeline() is responsible for filtering importance >= 3 and slicing to 5.
    // buildRoleplaySystemPrompt trusts the caller to pass already-filtered events.
    const timeline: TimelineEventRecord[] = [
      makeTimelineEvent({ id: "1", title: "Met Alex", detail: "Shook hands", importance: 5, turn_id: "turn_1" }),
      makeTimelineEvent({ id: "2", title: "Signal spiked", detail: "A distress call cut in", importance: 4, turn_id: "turn_2" }),
      makeTimelineEvent({ id: "3", title: "Dock lights failed", detail: "Everything went red", importance: 3, turn_id: "turn_3" }),
      makeTimelineEvent({ id: "4", title: "Engine room opened", detail: "Steam rushed out", importance: 4, turn_id: "turn_4" }),
      makeTimelineEvent({ id: "5", title: "Map updated", detail: "New route appeared", importance: 3, turn_id: "turn_5" }),
    ];
    const prompt = buildRoleplaySystemPrompt({
      character: mockCharacter,
      persona: mockPersona,
      snapshot: null,
      pins: [
        {
          id: "pin-1",
          thread_id: "t1",
          branch_id: "b1",
          turn_id: "turn-3",
          body: "Ash is injured on the left side.",
          status: "active",
          created_at: "",
          updated_at: "",
        },
      ],
      timeline,
    });

    expect(prompt).toContain("<pins_timeline>");
    expect(prompt).toContain("Ash is injured on the left side.");
    expect(prompt).toContain("- [5/5] Met Alex: Shook hands");
    expect(prompt).toContain("- [3/5] Map updated: New route appeared");
    expect(prompt).toContain("- [4/5] Engine room opened: Steam rushed out");
  });

  it("serializes the durable memory snapshot as structured JSON", () => {
    const snapshot: DurableMemorySnapshot = {
      metadata: {
        current_turn_id: "1",
        narrative_timestamp: "Dusk, day 3",
        transition_type: "continuation",
        version: 1,
      },
      spatial_state: {
        current_location: {
          id: "loc_1",
          name: "Engine Bay",
          description: "Dimly lit, steam venting from ruptured coolant line",
          environmental_modifiers: ["red alarm lights", "steam"],
        },
        adjacent_locations: [{ id: "loc_2", name: "Corridor B" }],
        known_locations: [
          {
            id: "loc_1",
            name: "Engine Bay",
            description: "Dimly lit, steam venting from ruptured coolant line",
            environmental_modifiers: ["red alarm lights", "steam"],
          },
          {
            id: "loc_2",
            name: "Corridor B",
            description: "Narrow passage connecting sections",
            environmental_modifiers: [],
          },
        ],
        edges: [
          {
            edge_id: "edge_1",
            from_location_id: "loc_1",
            to_location_id: "loc_2",
            is_bidirectional: true,
          },
        ],
        entity_placements: [],
      },
      entity_state: [
        {
          entity_id: "ent_1",
          canonical_name: "Alex",
          entity_type: "character",
          is_present: true,
          primary_emotion: "worried",
          emotion_intensity: 7,
          emotion_catalyst: "reactor failing",
          aliases: [],
          knowledge_boundary: [],
          traits: [{ id: "fact_1", body: "Gruff mechanic" }],
          goals: [],
          secrets: [],
          abilities: [],
          possessions: [],
        },
      ],
      relational_state: [
        {
          relationship_id: "rel_1",
          source_entity_id: "ent_1",
          source_entity_name: "Alex",
          target_entity_id: "ent_2",
          target_entity_name: "Riley",
          relationship_type: "social",
          dynamic_status: "Wary, but beginning to rely on each other",
        },
      ],
      narrative_state: {
        story_summary: "Alex met Riley in a failing shipyard.",
        scene_summary: "They are in the engine bay.",
        last_turn_beat: "Riley admitted the ship cannot leave.",
        active_threads: [{ thread_id: "nt_1", objective: "Engine fix", status: "open", dependencies: [] }],
        resolved_threads: ["Introductions"],
      },
    };

    const prompt = buildRoleplaySystemPrompt({
      character: mockCharacter,
      persona: mockPersona,
      snapshot,
      pins: [],
      timeline: [],
    });

    // The snapshot is JSON-serialized into the durable_state section
    expect(prompt).toContain("<durable_state>");
    expect(prompt).toContain("Alex met Riley in a failing shipyard.");
    expect(prompt).toContain("Engine Bay");
    expect(prompt).toContain("Wary, but beginning to rely on each other");
    expect(prompt).toContain("Engine fix");
    expect(prompt).not.toContain("No world state has been materialized yet.");
  });
});
