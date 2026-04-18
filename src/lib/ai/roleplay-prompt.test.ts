import { describe, it, expect } from "vitest";
import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";
import type { CharacterBundle } from "@/lib/data/characters";
import type { UserPersonaRecord, ThreadStateSnapshot, TimelineEventRecord } from "@/lib/types";

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
  it("should include story as the primary context block", () => {
    const prompt = buildRoleplaySystemPrompt({
      character: mockCharacter,
      persona: mockPersona,
      snapshot: null,
      pins: [],
      timeline: [],
    });

    expect(prompt).toContain("You are roleplaying as Alex.");
    expect(prompt).toContain("── STORY AND SETTING ──");
    expect(prompt).toContain("A salvaged shipyard orbiting a dead moon");
    expect(prompt).toContain("Current scenario: Unknown");
    expect(prompt).toContain("── CHARACTER ──");
    expect(prompt).toContain("── NARRATIVE STATE ──");
    expect(prompt).toContain("── DIRECTIVES ──");
    expect(prompt).toContain("- None active."); // open loops
  });

  it("should omit story section when story is empty", () => {
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

    expect(prompt).not.toContain("── STORY AND SETTING ──");
    expect(prompt).toContain("── CHARACTER ──");
  });

  it("should format timeline events correctly", () => {
    const timeline: TimelineEventRecord[] = [
      { id: "1", thread_id: "t1", title: "Met Alex", detail: "Shook hands", importance: 3, branch_id: "b1", turn_id: "turn_1", created_at: "" },
    ];
    const prompt = buildRoleplaySystemPrompt({
      character: mockCharacter,
      persona: mockPersona,
      snapshot: null,
      pins: [],
      timeline,
    });
    expect(prompt).toContain("- [3/5] Met Alex: Shook hands");
  });

  it("should format snapshot lists defensively avoiding undefined crashes", () => {
    const snapshot = {
      turn_id: "1",
      thread_id: "t1",
      branch_id: "b1",
      based_on_turn_id: null,
      version: 1,
      scenario_state: "Stranded",
      relationship_state: "Wary",
      rolling_summary: "Ship is broken.",
      user_facts: ["Is a pilot", "Needs help"],
      open_loops: ["Engine fix"],
      resolved_loops: ["Introductions"],
      narrative_hooks: ["Mysterious signal"],
      scene_goals: ["Assess damage"],
      updated_at: "",
    } as ThreadStateSnapshot;

    const prompt = buildRoleplaySystemPrompt({
      character: mockCharacter,
      persona: mockPersona,
      snapshot,
      pins: [],
      timeline: [],
    });

    expect(prompt).toContain("Current scenario: Stranded");
    expect(prompt).toContain("Relationship: Wary");
    expect(prompt).toContain("What happened so far: Ship is broken.");
    expect(prompt).toContain("Known facts about the user: Is a pilot; Needs help");
    expect(prompt).toContain("- Engine fix");
    expect(prompt).toContain("- Introductions");
    expect(prompt).toContain("- Mysterious signal");
    expect(prompt).toContain("- Assess damage");
  });
});
