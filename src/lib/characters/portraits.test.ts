import { describe, expect, it } from "vitest";
import {
  buildCharacterPortraitPrompt,
  buildCharacterPortraitSourceHash,
  planCharacterPortraitState,
} from "@/lib/characters/portraits";

const baseInput = {
  name: "Captain Mirelle",
  appearance: "Sea-dark curls, weathered bronze skin, long navy coat, brass spyglass",
  tagline: "A lighthouse keeper who speaks like the tide remembers her.",
  short_description: "Carries stormlight in her posture and a map in every silence.",
};

describe("character portraits", () => {
  it("builds a stable source hash from the portrait-driving fields", () => {
    const left = buildCharacterPortraitSourceHash(baseInput);
    const right = buildCharacterPortraitSourceHash(baseInput);
    const changed = buildCharacterPortraitSourceHash({
      ...baseInput,
      appearance: "Sea-dark curls, weathered bronze skin, red captain's coat",
    });

    expect(left).toBe(right);
    expect(changed).not.toBe(left);
  });

  it("builds a portrait prompt from the visual authoring fields", () => {
    const prompt = buildCharacterPortraitPrompt(baseInput);

    expect(prompt).toContain(baseInput.name);
    expect(prompt).toContain(baseInput.appearance);
    expect(prompt).toContain("cinematic fantasy character portrait");
  });

  it("returns an idle portrait state when appearance is blank", () => {
    const plan = planCharacterPortraitState({
      existing: null,
      input: {
        ...baseInput,
        appearance: "   ",
      },
    });

    expect(plan.shouldEnqueue).toBe(false);
    expect(plan.nextPortrait.portrait_status).toBe("idle");
    expect(plan.nextPortrait.portrait_path).toBe("");
    expect(plan.nextPortrait.portrait_source_hash).toBe("");
  });

  it("marks portraits pending when the source hash changes", () => {
    const plan = planCharacterPortraitState({
      existing: {
        id: "char-1",
        user_id: "user-1",
        name: baseInput.name,
        appearance: "Old appearance",
        tagline: baseInput.tagline,
        short_description: baseInput.short_description,
        long_description: "",
        greeting: "",
        world_context: "",
        core_persona: "",
        style_rules: "",
        scenario_seed: "",
        author_notes: "",
        definition: "",
        negative_guidance: "",
        portrait_status: "ready",
        portrait_path: "user/char/old.jpg",
        portrait_prompt: "old prompt",
        portrait_seed: 12,
        portrait_source_hash: "old-hash",
        portrait_last_error: "",
        portrait_generated_at: new Date().toISOString(),
        temperature: 0.92,
        top_p: 0.94,
        max_output_tokens: 750,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      input: baseInput,
    });

    expect(plan.shouldEnqueue).toBe(true);
    expect(plan.nextPortrait.portrait_status).toBe("pending");
    expect(plan.nextPortrait.portrait_path).toBe("");
    expect(plan.prompt).toContain(baseInput.appearance);
  });
});
