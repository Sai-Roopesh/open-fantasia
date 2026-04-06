"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import { deleteCharacter, upsertCharacterBundle } from "@/lib/data/characters";
import { listConnections } from "@/lib/data/connections";
import { getDefaultPersona } from "@/lib/data/personas";
import { createThread } from "@/lib/data/threads";
import {
  characterDeleteCommandSchema,
  saveCharacterCommandSchema,
  startThreadCommandSchema,
} from "@/lib/validation";

export async function saveCharacterAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const parsed = saveCharacterCommandSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    name: String(formData.get("name") ?? "").trim(),
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
    temperature: String(formData.get("temperature") ?? "0.92"),
    top_p: String(formData.get("top_p") ?? "0.94"),
    max_output_tokens: String(formData.get("max_output_tokens") ?? "750"),
    starters: formData.getAll("starter_text").map((value) => String(value)),
    exampleConversations: formData
      .getAll("example_user_line")
      .map((value, index) => ({
        user_line: String(value),
        character_line: String(formData.getAll("example_character_line")[index] ?? ""),
      })),
  });

  if (!parsed.success) {
    redirect("/app/characters?reason=name");
  }

  const character = await upsertCharacterBundle(supabase, user.id, parsed.data);

  revalidatePath("/app/characters");
  redirect(`/app/characters?edit=${character.character.id}&saved=1`);
}

export async function startThreadAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = startThreadCommandSchema.safeParse({
    characterId: String(formData.get("characterId") ?? ""),
  });
  if (!parsed.success) {
    redirect("/app/characters?reason=character");
  }

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
    characterId: parsed.data.characterId,
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
  const parsed = characterDeleteCommandSchema.safeParse({
    characterId: String(formData.get("characterId") ?? "").trim(),
  });

  if (!parsed.success) {
    redirect("/app/characters");
  }

  await deleteCharacter(supabase, user.id, parsed.data.characterId);

  revalidatePath("/app");
  revalidatePath("/app/characters");
  redirect("/app/characters?deleted=1");
}
