"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import { deleteCharacter, upsertCharacterBundle } from "@/lib/data/characters";
import { listConnections } from "@/lib/data/connections";
import { getDefaultPersona } from "@/lib/data/personas";
import { createThread } from "@/lib/data/threads";

export async function saveCharacterAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/app/characters?reason=name");
  }

  const character = await upsertCharacterBundle(supabase, user.id, {
    id: String(formData.get("id") ?? "").trim() || undefined,
    name,
    tagline: String(formData.get("tagline") ?? ""),
    short_description: String(formData.get("short_description") ?? ""),
    long_description: String(formData.get("long_description") ?? ""),
    greeting: String(formData.get("greeting") ?? ""),
    core_persona: String(formData.get("core_persona") ?? ""),
    style_rules: String(formData.get("style_rules") ?? ""),
    scenario_seed: String(formData.get("scenario_seed") ?? ""),
    author_notes: String(formData.get("author_notes") ?? ""),
    definition: String(formData.get("definition") ?? ""),
    negative_guidance: String(formData.get("negative_guidance") ?? ""),
    example_dialogue: "",
    starters: formData
      .getAll("starter_text")
      .map((value) => String(value)),
    exampleConversations: formData
      .getAll("example_user_line")
      .map((value, index) => ({
        user_line: String(value),
        character_line: String(formData.getAll("example_character_line")[index] ?? ""),
      })),
  });

  revalidatePath("/app/characters");
  redirect(`/app/characters?edit=${character.character.id}&saved=1`);
}

export async function startThreadAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const characterId = String(formData.get("characterId") ?? "");
  const connections = await listConnections(supabase, user.id);
  const persona = await getDefaultPersona(supabase, user.id);
  const usableConnection = connections.find(
    (connection) => connection.enabled && connection.model_cache.length > 0,
  );

  if (!persona) {
    redirect("/app/personas?reason=default");
  }

  if (!usableConnection) {
    redirect("/app/settings/providers?reason=connection");
  }

  const thread = await createThread(supabase, user.id, {
    characterId,
    connection: usableConnection!,
    modelId: usableConnection!.model_cache[0].id,
    personaId: persona!.id,
    title: "New roleplay thread",
  });

  revalidatePath("/app");
  redirect(`/app/chats/${thread.id}`);
}

export async function deleteCharacterAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const characterId = String(formData.get("characterId") ?? "").trim();

  if (!characterId) {
    redirect("/app/characters");
  }

  await deleteCharacter(supabase, user.id, characterId);

  revalidatePath("/app");
  revalidatePath("/app/characters");
  redirect("/app/characters?deleted=1");
}
