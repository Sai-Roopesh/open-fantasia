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
  story: string;
  core_persona: string;
  greeting: string;
  appearance: string;
  style_rules: string;
  definition: string;
  negative_guidance: string;
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
          story: editing.character.story,
          core_persona: editing.character.core_persona,
          greeting: editing.character.greeting,
          appearance: editing.character.appearance,
          style_rules: editing.character.style_rules,
          definition: editing.character.definition,
          negative_guidance: editing.character.negative_guidance,
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
    story: draft.story,
    core_persona: draft.core_persona,
    greeting: draft.greeting,
    appearance: draft.appearance,
    style_rules: draft.style_rules,
    definition: draft.definition,
    negative_guidance: draft.negative_guidance,
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
    story: data.story,
    core_persona: data.core_persona,
    greeting: data.greeting,
    appearance: data.appearance,
    style_rules: data.style_rules,
    definition: data.definition,
    negative_guidance: data.negative_guidance,
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
