import type { CharacterBundle } from "@/lib/data/characters";
import type { UserPersonaRecord } from "@/lib/types";
import type {
  OpenFantasiaCharacterData,
  OpenFantasiaPersonaData,
} from "@/lib/portability/openfantasia-json";
import {
  openFantasiaCharacterDataDefaults,
  openFantasiaPersonaDataDefaults,
} from "@/lib/portability/openfantasia-json";

export type CharacterDraft = {
  name: string;
  appearance: string;
  tagline: string;
  short_description: string;
  long_description: string;
  greeting: string;
  core_persona: string;
  style_rules: string;
  scenario_seed: string;
  definition: string;
  negative_guidance: string;
  author_notes: string;
  starters: string[];
  examples: Array<{ user: string; character: string }>;
};

export type PersonaDraft = {
  name: string;
  identity: string;
  backstory: string;
  voice_style: string;
  goals: string;
  boundaries: string;
  private_notes: string;
  is_default: boolean;
};

export function createCharacterDraft(editing: CharacterBundle | null): CharacterDraft {
  return {
    ...openFantasiaCharacterDataDefaults,
    ...(editing
      ? {
          name: editing.character.name,
          appearance: editing.character.appearance,
          tagline: editing.character.tagline,
          short_description: editing.character.short_description,
          long_description: editing.character.long_description,
          greeting: editing.character.greeting,
          core_persona: editing.character.core_persona,
          style_rules: editing.character.style_rules,
          scenario_seed: editing.character.scenario_seed,
          definition: editing.character.definition,
          negative_guidance: editing.character.negative_guidance,
          author_notes: editing.character.author_notes,
        }
      : {}),
    starters: editing?.starters.length
      ? editing.starters.map((starter) => starter.text)
      : [""],
    examples: editing?.exampleConversations.length
      ? editing.exampleConversations.map((example) => ({
          user: example.user_line,
          character: example.character_line,
        }))
      : [{ user: "", character: "" }],
  };
}

export function characterDraftToPortableData(
  draft: CharacterDraft,
): OpenFantasiaCharacterData {
  return {
    name: draft.name,
    appearance: draft.appearance,
    tagline: draft.tagline,
    short_description: draft.short_description,
    long_description: draft.long_description,
    greeting: draft.greeting,
    core_persona: draft.core_persona,
    style_rules: draft.style_rules,
    scenario_seed: draft.scenario_seed,
    definition: draft.definition,
    negative_guidance: draft.negative_guidance,
    author_notes: draft.author_notes,
    suggested_starters: draft.starters,
    example_conversations: draft.examples.map((example) => ({
      user_line: example.user,
      character_line: example.character,
    })),
  };
}

export function portableCharacterDataToDraft(
  data: OpenFantasiaCharacterData,
): CharacterDraft {
  return {
    name: data.name,
    appearance: data.appearance,
    tagline: data.tagline,
    short_description: data.short_description,
    long_description: data.long_description,
    greeting: data.greeting,
    core_persona: data.core_persona,
    style_rules: data.style_rules,
    scenario_seed: data.scenario_seed,
    definition: data.definition,
    negative_guidance: data.negative_guidance,
    author_notes: data.author_notes,
    starters: [...data.suggested_starters],
    examples: data.example_conversations.map((example) => ({
      user: example.user_line,
      character: example.character_line,
    })),
  };
}

export function createPersonaDraft(
  editing: UserPersonaRecord | null,
  personaCount: number,
): PersonaDraft {
  return {
    ...openFantasiaPersonaDataDefaults,
    ...(editing
      ? {
          name: editing.name,
          identity: editing.identity,
          backstory: editing.backstory,
          voice_style: editing.voice_style,
          goals: editing.goals,
          boundaries: editing.boundaries,
          private_notes: editing.private_notes,
        }
      : {}),
    is_default: editing?.is_default ?? personaCount === 0,
  };
}

export function personaDraftToPortableData(
  draft: PersonaDraft,
): OpenFantasiaPersonaData {
  return {
    name: draft.name,
    identity: draft.identity,
    backstory: draft.backstory,
    voice_style: draft.voice_style,
    goals: draft.goals,
    boundaries: draft.boundaries,
    private_notes: draft.private_notes,
  };
}

export function portablePersonaDataToDraft(
  data: OpenFantasiaPersonaData,
  currentIsDefault: boolean,
): PersonaDraft {
  return {
    ...data,
    is_default: currentIsDefault,
  };
}
