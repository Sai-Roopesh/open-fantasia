import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CharacterExampleConversationRecord,
  CharacterRecord,
  CharacterStarterRecord,
} from "@/lib/types";

export type CharacterBundle = {
  character: CharacterRecord;
  starters: CharacterStarterRecord[];
  exampleConversations: CharacterExampleConversationRecord[];
};

export async function listCharacters(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CharacterRecord[];
}

export async function getCharacterBundle(
  supabase: SupabaseClient,
  userId: string,
  characterId: string,
) {
  const [{ data: character, error: characterError }, { data: starters, error: startersError }, { data: examples, error: examplesError }] =
    await Promise.all([
      supabase
        .from("characters")
        .select("*")
        .eq("user_id", userId)
        .eq("id", characterId)
        .maybeSingle(),
      supabase
        .from("character_starters")
        .select("*")
        .eq("character_id", characterId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("character_example_conversations")
        .select("*")
        .eq("character_id", characterId)
        .order("sort_order", { ascending: true }),
    ]);

  if (characterError) throw characterError;
  if (startersError) throw startersError;
  if (examplesError) throw examplesError;
  if (!character) return null;

  return {
    character: character as CharacterRecord,
    starters: (starters ?? []) as CharacterStarterRecord[],
    exampleConversations: (examples ?? []) as CharacterExampleConversationRecord[],
  } satisfies CharacterBundle;
}

export async function upsertCharacterBundle(
  supabase: SupabaseClient,
  userId: string,
  payload: Partial<CharacterRecord> & {
    id?: string;
    name: string;
    starters: string[];
    exampleConversations: Array<{ user_line: string; character_line: string }>;
  },
) {
  const nextCharacter = {
    id: payload.id,
    user_id: userId,
    name: payload.name,
    tagline: payload.tagline ?? "",
    short_description: payload.short_description ?? "",
    long_description: payload.long_description ?? "",
    greeting: payload.greeting ?? "",
    core_persona: payload.core_persona ?? "",
    style_rules: payload.style_rules ?? "",
    scenario_seed: payload.scenario_seed ?? "",
    example_dialogue: payload.example_dialogue ?? "",
    author_notes: payload.author_notes ?? "",
    definition: payload.definition ?? "",
    negative_guidance: payload.negative_guidance ?? "",
  };

  const characterQuery = payload.id
    ? supabase
        .from("characters")
        .update(nextCharacter)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select("*")
        .single()
    : supabase.from("characters").insert(nextCharacter).select("*").single();

  const { data: character, error } = await characterQuery;
  if (error) throw error;

  const characterId = (character as CharacterRecord).id;

  const [deleteStartersResult, deleteExamplesResult] = await Promise.all([
    supabase.from("character_starters").delete().eq("character_id", characterId),
    supabase.from("character_example_conversations").delete().eq("character_id", characterId),
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

export async function deleteCharacter(
  supabase: SupabaseClient,
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
