import type {
  CharacterExampleConversationRecord,
  CharacterInsert,
  CharacterRecord,
  CharacterStarterRecord,
} from "@/lib/types";
import { castRow, castRows, type DatabaseClient } from "@/lib/data/shared";

export type CharacterBundle = {
  character: CharacterRecord;
  starters: CharacterStarterRecord[];
  exampleConversations: CharacterExampleConversationRecord[];
};

const characterSelect = [
  "id",
  "user_id",
  "name",
  "appearance",
  "tagline",
  "short_description",
  "long_description",
  "greeting",
  "core_persona",
  "style_rules",
  "scenario_seed",
  "author_notes",
  "definition",
  "negative_guidance",
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

const starterSelect = [
  "id",
  "character_id",
  "text",
  "sort_order",
  "created_at",
  "updated_at",
].join(", ");

const exampleSelect = [
  "id",
  "character_id",
  "user_line",
  "character_line",
  "sort_order",
  "created_at",
  "updated_at",
].join(", ");

export async function listCharacters(supabase: DatabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("characters")
    .select(characterSelect)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return castRows<CharacterRecord>(data);
}

export async function getCharacterBundle(
  supabase: DatabaseClient,
  userId: string,
  characterId: string,
) {
  const [
    { data: character, error: characterError },
    { data: starters, error: startersError },
    { data: examples, error: examplesError },
  ] = await Promise.all([
    supabase
      .from("characters")
      .select(characterSelect)
      .eq("user_id", userId)
      .eq("id", characterId)
      .maybeSingle(),
    supabase
      .from("character_starters")
      .select(starterSelect)
      .eq("character_id", characterId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("character_example_conversations")
      .select(exampleSelect)
      .eq("character_id", characterId)
      .order("sort_order", { ascending: true }),
  ]);

  if (characterError) throw characterError;
  if (startersError) throw startersError;
  if (examplesError) throw examplesError;
  if (!character) return null;

  return {
    character: castRow<CharacterRecord>(character),
    starters: castRows<CharacterStarterRecord>(starters),
    exampleConversations: castRows<CharacterExampleConversationRecord>(examples),
  } satisfies CharacterBundle;
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

  if (error) throw error;
  return data ? castRow<CharacterRecord>(data) : null;
}

export async function upsertCharacterBundle(
  supabase: DatabaseClient,
  userId: string,
  payload: Partial<CharacterRecord> & {
    id?: string;
    name: string;
    starters: string[];
    exampleConversations: Array<{ user_line: string; character_line: string }>;
  },
) {
  const nextCharacter: CharacterInsert = {
    id: payload.id,
    user_id: userId,
    name: payload.name,
    appearance: payload.appearance ?? "",
    tagline: payload.tagline ?? "",
    short_description: payload.short_description ?? "",
    long_description: payload.long_description ?? "",
    greeting: payload.greeting ?? "",
    core_persona: payload.core_persona ?? "",
    style_rules: payload.style_rules ?? "",
    scenario_seed: payload.scenario_seed ?? "",
    author_notes: payload.author_notes ?? "",
    definition: payload.definition ?? "",
    negative_guidance: payload.negative_guidance ?? "",
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

  const characterQuery = payload.id
    ? supabase
        .from("characters")
        .update(nextCharacter)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select(characterSelect)
        .single()
    : supabase
        .from("characters")
        .insert(nextCharacter)
        .select(characterSelect)
        .single();

  const { data: character, error } = await characterQuery;
  if (error) throw error;

  const characterId = castRow<CharacterRecord>(character).id;

  const [deleteStartersResult, deleteExamplesResult] = await Promise.all([
    supabase.from("character_starters").delete().eq("character_id", characterId),
    supabase
      .from("character_example_conversations")
      .delete()
      .eq("character_id", characterId),
  ]);

  if (deleteStartersResult.error) throw deleteStartersResult.error;
  if (deleteExamplesResult.error) throw deleteExamplesResult.error;

  const starters = payload.starters
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      character_id: characterId,
      text,
      sort_order: index,
    }));

  const exampleConversations = payload.exampleConversations
    .map((example) => ({
      user_line: example.user_line.trim(),
      character_line: example.character_line.trim(),
    }))
    .filter((example) => example.user_line || example.character_line)
    .map((example, index) => ({
      character_id: characterId,
      user_line: example.user_line,
      character_line: example.character_line,
      sort_order: index,
    }));

  if (starters.length) {
    const { error: startersInsertError } = await supabase
      .from("character_starters")
      .insert(starters);
    if (startersInsertError) throw startersInsertError;
  }

  if (exampleConversations.length) {
    const { error: examplesInsertError } = await supabase
      .from("character_example_conversations")
      .insert(exampleConversations);
    if (examplesInsertError) throw examplesInsertError;
  }

  const bundle = await getCharacterBundle(supabase, userId, characterId);
  if (!bundle) {
    throw new Error("Failed to reload character bundle.");
  }

  return bundle;
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

  if (error) throw error;
  return castRow<CharacterRecord>(data);
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

  if (error) throw error;
}
