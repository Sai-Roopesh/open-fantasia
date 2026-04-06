import { buildRoleplaySystemPrompt } from "@/lib/ai/roleplay-prompt";

describe("buildRoleplaySystemPrompt", () => {
  it("includes continuity, persona, pins, and timeline context", () => {
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
        scene_goals: ["Get off the roof unseen."],
        version: 1,
        updated_at: "",
      },
      pins: [{ body: "Ari hates being pitied." }] as never,
      timeline: [{ importance: 4, title: "The return", detail: "Ari came back injured." }] as never,
    });

    expect(prompt).toContain("A rooftop negotiation in the rain.");
    expect(prompt).toContain("Protect Ari");
    expect(prompt).toContain("Ari hates being pitied.");
    expect(prompt).toContain("The return");
  });
});
