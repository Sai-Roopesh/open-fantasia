import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";

describe("buildRoleplaySystemPrompt", () => {
  it("includes continuity, persona, pins, timeline, and narrative hooks", () => {
    const prompt = buildRoleplaySystemPrompt({
      character: {
        character: {
          id: crypto.randomUUID(),
          user_id: crypto.randomUUID(),
          name: "Ari",
          tagline: "Knife-edge charm",
          short_description: "A sharp-tongued thief",
          long_description: "",
          greeting: "She looks over her shoulder.",
          core_persona: "Untrusting but curious",
          style_rules: "Lean, intimate prose",
          scenario_seed: "Rain-soaked rooftop",
          author_notes: "Keep the tension playful",
          definition: "Expert lockbreaker",
          negative_guidance: "No slapstick",
          temperature: 0.92,
          top_p: 0.94,
          max_output_tokens: 750,
          created_at: "",
          updated_at: "",
        },
        starters: [{ text: "Meet me on the roof." }] as never,
        exampleConversations: [
          {
            user_line: "Why did you come back?",
            character_line: "Because leaving you alone felt worse.",
          },
        ] as never,
      },
      persona: {
        id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
        name: "Watcher",
        identity: "A patient observer",
        backstory: "",
        voice_style: "Measured",
        goals: "Protect Ari",
        boundaries: "No cruelty",
        private_notes: "",
        is_default: true,
        created_at: "",
        updated_at: "",
      },
      snapshot: {
        checkpoint_id: crypto.randomUUID(),
        thread_id: crypto.randomUUID(),
        branch_id: crypto.randomUUID(),
        based_on_snapshot_id: null,
        scenario_state: "A rooftop negotiation in the rain.",
        relationship_state: "Trust is fragile.",
        rolling_summary: "Ari returned with stolen letters.",
        user_facts: ["The user covers for Ari."],
        open_loops: ["Who hired the guards?"],
        resolved_loops: ["Whether Ari would return."],
        narrative_hooks: ["Ari has an unopened letter she's hiding."],
        scene_goals: ["Get off the roof unseen."],
        version: 1,
        updated_at: "",
      },
      pins: [{ body: "Ari hates being pitied." }] as never,
      timeline: [{ importance: 4, title: "The return", detail: "Ari came back injured." }] as never,
    });

    // Continuity
    expect(prompt).toContain("A rooftop negotiation in the rain.");
    // Persona
    expect(prompt).toContain("Protect Ari");
    // Pins
    expect(prompt).toContain("Ari hates being pitied.");
    // Timeline
    expect(prompt).toContain("The return");
    // Active loops
    expect(prompt).toContain("Who hired the guards?");
    // Resolved loops
    expect(prompt).toContain("Whether Ari would return.");
    expect(prompt).toContain("do not reopen");
    // Narrative hooks
    expect(prompt).toContain("Ari has an unopened letter she's hiding.");
    // Proactive directive
    expect(prompt).toContain("Be proactive");
    // Recency bias
    expect(prompt).toContain("what happens NEXT");
    // Anti-godmoding
    expect(prompt).toContain("Never write, speak, act, decide, or think for the user");
  });

  it("handles null snapshot gracefully", () => {
    const prompt = buildRoleplaySystemPrompt({
      character: {
        character: {
          id: crypto.randomUUID(),
          user_id: crypto.randomUUID(),
          name: "Test",
          tagline: "",
          short_description: "",
          long_description: "",
          greeting: "",
          core_persona: "",
          style_rules: "",
          scenario_seed: "",
          author_notes: "",
          definition: "",
          negative_guidance: "",
          temperature: 0.92,
          top_p: 0.94,
          max_output_tokens: 750,
          created_at: "",
          updated_at: "",
        },
        starters: [],
        exampleConversations: [],
      },
      persona: {
        id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
        name: "Default",
        identity: "",
        backstory: "",
        voice_style: "",
        goals: "",
        boundaries: "",
        private_notes: "",
        is_default: true,
        created_at: "",
        updated_at: "",
      },
      snapshot: null,
      pins: [],
      timeline: [],
    });

    expect(prompt).toContain("Unknown");
    expect(prompt).toContain("None active.");
    expect(prompt).toContain("Nothing resolved yet.");
    expect(prompt).toContain("None yet.");
  });
});
