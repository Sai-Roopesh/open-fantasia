import type {
  CharacterExampleConversationRecord,
  CharacterRecord,
  CharacterStarterRecord,
} from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";
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
  "story",
  "core_persona",
  "greeting",
  "appearance",
  "style_rules",
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
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select(characterSelect)
    .eq("user_id", userId)
    .eq("id", characterId)
    .maybeSingle();

  if (characterError) throw characterError;
  if (!character) return null;

  const [
    { data: starters, error: startersError },
    { data: examples, error: examplesError },
  ] = await Promise.all([
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

  if (startersError) throw startersError;
  if (examplesError) throw examplesError;

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
  const characterPayload = {
    id: payload.id ?? undefined,
    name: payload.name,
    story: payload.story ?? "",
    core_persona: payload.core_persona ?? "",
    greeting: payload.greeting ?? "",
    appearance: payload.appearance ?? "",
    style_rules: payload.style_rules ?? "",
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

  const starters = payload.starters
    .map((text) => ({ text: text.trim() }))
    .filter((s) => s.text.length > 0);

  const examples = payload.exampleConversations
    .map((e) => ({
      user_line: e.user_line.trim(),
      character_line: e.character_line.trim(),
    }))
    .filter((e) => e.user_line || e.character_line);

  const { data: characterId, error } = await supabase.rpc("upsert_character_bundle", {
    p_user_id: userId,
    p_character: characterPayload as unknown as Json,
    p_starters: starters as unknown as Json,
    p_examples: examples as unknown as Json,
  });

  if (error) throw error;

  const bundle = await getCharacterBundle(supabase, userId, String(characterId));
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
