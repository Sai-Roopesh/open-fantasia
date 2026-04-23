import { describe, expect, it } from "vitest";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import type { CharacterBundle } from "@/lib/data/characters";
import type { ThreadStateSnapshot, TimelineEventRecord, UserPersonaRecord } from "@/lib/types";

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

describe("buildRoleplaySystemPrompt", () => {
  it("includes tagged sections for the hybrid memory prompt", () => {
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
    expect(prompt).toContain("<durable_memory>");
    expect(prompt).toContain("Story summary: No durable story summary yet.");
    expect(prompt).toContain("<current_scene>");
    expect(prompt).toContain("Scene summary: No current-scene summary yet.");
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

  it("limits timeline context to recent high-importance beats", () => {
    const timeline: TimelineEventRecord[] = [
      { id: "1", thread_id: "t1", title: "Met Alex", detail: "Shook hands", importance: 5, branch_id: "b1", turn_id: "turn_1", created_at: "" },
      { id: "2", thread_id: "t1", title: "Signal spiked", detail: "A distress call cut in", importance: 4, branch_id: "b1", turn_id: "turn_2", created_at: "" },
      { id: "3", thread_id: "t1", title: "Dock lights failed", detail: "Everything went red", importance: 3, branch_id: "b1", turn_id: "turn_3", created_at: "" },
      { id: "4", thread_id: "t1", title: "Engine room opened", detail: "Steam rushed out", importance: 4, branch_id: "b1", turn_id: "turn_4", created_at: "" },
      { id: "5", thread_id: "t1", title: "Map updated", detail: "New route appeared", importance: 3, branch_id: "b1", turn_id: "turn_5", created_at: "" },
      { id: "6", thread_id: "t1", title: "Old rumor", detail: "A minor aside", importance: 2, branch_id: "b1", turn_id: "turn_6", created_at: "" },
      { id: "7", thread_id: "t1", title: "Fuel leak", detail: "A line cracked open", importance: 5, branch_id: "b1", turn_id: "turn_7", created_at: "" },
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
    expect(prompt).not.toContain("Old rumor");
    expect(prompt).not.toContain("Fuel leak");
  });

  it("renders the new snapshot fields defensively", () => {
    const snapshot = {
      turn_id: "1",
      thread_id: "t1",
      branch_id: "b1",
      based_on_turn_id: null,
      version: 1,
      story_summary: "Alex met Riley in a failing shipyard and realized the station was more damaged than it first looked.",
      scene_summary: "They are in the engine bay, standing over a ruptured coolant line while alarms pulse through the corridor.",
      last_turn_beat: "Riley admitted the ship cannot leave unless Alex trusts them with the override codes.",
      relationship_state: "Wary, but beginning to rely on each other.",
      user_facts: ["Is a pilot", "Needs help"],
      active_threads: ["Engine fix"],
      resolved_threads: ["Introductions"],
      next_turn_pressure: ["Choose whether to share the override codes"],
      scene_goals: ["Stabilize the engine"],
      updated_at: "",
    } as ThreadStateSnapshot;

    const prompt = buildRoleplaySystemPrompt({
      character: mockCharacter,
      persona: mockPersona,
      snapshot,
      pins: [],
      timeline: [],
    });

    expect(prompt).toContain("Story summary: Alex met Riley");
    expect(prompt).toContain("Scene summary: They are in the engine bay");
    expect(prompt).toContain("Last beat: Riley admitted");
    expect(prompt).toContain("Relationship state: Wary, but beginning to rely on each other.");
    expect(prompt).toContain("- Engine fix");
    expect(prompt).toContain("- Introductions");
    expect(prompt).toContain("- Choose whether to share the override codes");
    expect(prompt).toContain("- Stabilize the engine");
  });
});
