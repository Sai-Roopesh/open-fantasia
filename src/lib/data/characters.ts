import { z } from "zod";
import { parseRow, parseRows, type DatabaseClient } from "@/lib/data/shared";
import type {
  CharacterExampleConversation,
  CharacterRecord,
  CharacterStarter,
} from "@/lib/types";
import {
  characterExampleConversationSchema,
  characterStarterSchema,
} from "@/lib/types";

export type CharacterBundle = {
  character: CharacterRecord;
  starters: CharacterStarter[];
  exampleConversations: CharacterExampleConversation[];
};

const characterRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  story: z.string(),
  core_persona: z.string(),
  greeting: z.string(),
  appearance: z.string(),
  style_rules: z.string(),
  definition: z.string(),
  negative_guidance: z.string(),
  starters: z.array(characterStarterSchema),
  example_conversations: z.array(characterExampleConversationSchema),
  portrait_status: z.enum(["idle", "pending", "ready", "failed"]),
  portrait_path: z.string(),
  portrait_prompt: z.string(),
  portrait_seed: z.number().int().nullable(),
  portrait_source_hash: z.string(),
  portrait_last_error: z.string(),
  portrait_generated_at: z.string().nullable(),
  temperature: z.number(),
  top_p: z.number(),
  max_output_tokens: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

const characterSelect = [
  "id",
  "user_id",
  "name",
  "story",
  "core_persona",
  "greeting",
  "appearance",
  "style_rules",
  "definition",
  "negative_guidance",
  "starters",
  "example_conversations",
  "portrait_status",
  "portrait_path",
  "portrait_prompt",
  "portrait_seed",
  "portrait_source_hash",
  "portrait_last_error",
  "portrait_generated_at",
  "temperature",
  "top_p",
  "max_output_tokens",
  "created_at",
  "updated_at",
].join(", ");

function normalizeCharacter(value: unknown, label = "Character") {
  return parseRow(value, characterRecordSchema, label) as CharacterRecord;
}

function normalizeCharacters(value: unknown, label = "Characters") {
  return parseRows(value, characterRecordSchema, label) as CharacterRecord[];
}

function toBundle(character: CharacterRecord): CharacterBundle {
  return {
    character,
    starters: character.starters,
    exampleConversations: character.example_conversations,
  };
}

export async function listCharacters(supabase: DatabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("characters")
    .select(characterSelect)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return normalizeCharacters(data ?? [], "Character list");
}

export async function getCharacter(
  supabase: DatabaseClient,
  userId: string,
  characterId: string,
) {
  const { data, error } = await supabase
    .from("characters")
    .select(characterSelect)
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeCharacter(data) : null;
}

export async function getCharacterBundle(
  supabase: DatabaseClient,
  userId: string,
  characterId: string,
) {
  const character = await getCharacter(supabase, userId, characterId);
  return character ? toBundle(character) : null;
}

export async function upsertCharacterBundle(
  supabase: DatabaseClient,
  userId: string,
  payload: Omit<Partial<CharacterRecord>, "starters" | "example_conversations"> & {
    id?: string;
    name: string;
    starters: string[];
    exampleConversations: Array<{ user_line: string; character_line: string }>;
  },
) {
  const starters = payload.starters
    .map((text) => ({ text: text.trim() }))
    .filter((entry) => entry.text.length > 0);
  const exampleConversations = payload.exampleConversations
    .map((entry) => ({
      user_line: entry.user_line.trim(),
      character_line: entry.character_line.trim(),
    }))
    .filter((entry) => entry.user_line || entry.character_line);

  const next = {
    user_id: userId,
    name: payload.name,
    story: payload.story ?? "",
    core_persona: payload.core_persona ?? "",
    greeting: payload.greeting ?? "",
    appearance: payload.appearance ?? "",
    style_rules: payload.style_rules ?? "",
    definition: payload.definition ?? "",
    negative_guidance: payload.negative_guidance ?? "",
    starters,
    example_conversations: exampleConversations,
    portrait_status: payload.portrait_status ?? "idle",
    portrait_path: payload.portrait_path ?? "",
    portrait_prompt: payload.portrait_prompt ?? "",
    portrait_seed: payload.portrait_seed ?? null,
    portrait_source_hash: payload.portrait_source_hash ?? "",
    portrait_last_error: payload.portrait_last_error ?? "",
    portrait_generated_at: payload.portrait_generated_at ?? null,
    temperature: payload.temperature ?? 0.92,
    top_p: payload.top_p ?? 0.94,
    max_output_tokens: payload.max_output_tokens ?? 750,
  };

  const query = payload.id
    ? supabase
        .from("characters")
        .update(next)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select(characterSelect)
        .single()
    : supabase
        .from("characters")
        .insert(next)
        .select(characterSelect)
        .single();

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return toBundle(normalizeCharacter(data, "Saved character"));
}

export async function updateCharacterPortrait(
  supabase: DatabaseClient,
  userId: string,
  characterId: string,
  updates: Partial<
    Pick<
      CharacterRecord,
      | "portrait_status"
      | "portrait_path"
      | "portrait_prompt"
      | "portrait_seed"
      | "portrait_source_hash"
      | "portrait_last_error"
      | "portrait_generated_at"
    >
  >,
) {
  const { data, error } = await supabase
    .from("characters")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", characterId)
    .eq("user_id", userId)
    .select(characterSelect)
    .single();

  if (error) {
    throw error;
  }

  return normalizeCharacter(data, "Updated character portrait");
}

export async function deleteCharacter(
  supabase: DatabaseClient,
  userId: string,
  characterId: string,
) {
  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("id", characterId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
