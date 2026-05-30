"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import { deleteCharacter } from "@/lib/data/characters";
import {
  saveCharacterWithPortrait,
  regenerateCharacterPortrait,
  startThread,
} from "@/lib/services/characters";
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
    story: String(formData.get("story") ?? ""),
    core_persona: String(formData.get("core_persona") ?? ""),
    greeting: String(formData.get("greeting") ?? ""),
    appearance: String(formData.get("appearance") ?? ""),
    style_rules: String(formData.get("style_rules") ?? ""),
    definition: String(formData.get("definition") ?? ""),
    negative_guidance: String(formData.get("negative_guidance") ?? ""),
    temperature: String(formData.get("temperature") ?? "0.92"),
    top_p: String(formData.get("top_p") ?? "0.94"),
    starters: formData
      .getAll("starter_text")
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0),
    exampleConversations: formData
      .getAll("example_user_line")
      .map((value, index) => ({
        user_line: String(value).trim(),
        character_line: String(formData.getAll("example_character_line")[index] ?? "").trim(),
      }))
      .filter((entry) => entry.user_line.length > 0 || entry.character_line.length > 0),
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    const reason = parsed.error.issues.some((i) => i.path[0] === "name")
      ? "name"
      : encodeURIComponent(fields);
    redirect(`/app/characters?reason=${reason}`);
  }

  let character;
  try {
    const bundle = await saveCharacterWithPortrait(supabase, user.id, parsed.data);
    character = bundle.character;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unknown error";
    redirect(`/app/characters?reason=${encodeURIComponent(message)}`);
  }

  revalidatePath("/app/characters");
  redirect(`/app/characters?edit=${character.id}&saved=1`);
}

export async function regenerateCharacterPortraitAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = characterDeleteCommandSchema.safeParse({
    characterId: String(formData.get("id") ?? "").trim(),
  });

  if (!parsed.success) redirect("/app/characters");

  const result = await regenerateCharacterPortrait(
    supabase,
    user.id,
    parsed.data.characterId,
  );
  if (!result) redirect("/app/characters");

  revalidatePath("/app/characters");
  redirect(`/app/characters?edit=${result.character.id}`);
}

export async function startThreadAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const modelSelect = String(formData.get("modelSelect") ?? "");
  const brainModelSelect = String(formData.get("brainModelSelect") ?? "");

  let connectionId: string | undefined;
  let modelId: string | undefined;
  if (modelSelect.includes(":")) {
    const parts = modelSelect.split(":");
    connectionId = parts[0];
    modelId = parts.slice(1).join(":");
  }

  let brainConnectionId: string | null = null;
  let brainModelId: string | null = null;
  if (brainModelSelect.includes(":")) {
    const parts = brainModelSelect.split(":");
    brainConnectionId = parts[0];
    brainModelId = parts.slice(1).join(":");
  }

  const parsed = startThreadCommandSchema.safeParse({
    characterId: String(formData.get("characterId") ?? ""),
    personaId: String(formData.get("personaId") ?? "").trim() || undefined,
    connectionId: connectionId || undefined,
    modelId: modelId || undefined,
    brainConnectionId: brainConnectionId || null,
    brainModelId: brainModelId || null,
  });
  if (!parsed.success) redirect("/app/characters?reason=character");

  const result = await startThread(supabase, user.id, {
    ...parsed.data,
    brainConnectionId: parsed.data.brainConnectionId ?? null,
    brainModelId: parsed.data.brainModelId ?? null,
  });

  if (!result.ok) {
    if (result.error === "character") redirect("/app/characters?reason=character");
    if (result.error === "persona") redirect("/app/personas?reason=default");
    if (result.error === "connection") redirect("/app/settings/providers?reason=connection");
    redirect("/app/settings/providers?reason=model");
  }

  revalidatePath("/app");
  redirect(`/app/chats/${result.threadId}`);
}

export async function deleteCharacterAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = characterDeleteCommandSchema.safeParse({
    characterId: String(formData.get("characterId") ?? "").trim(),
  });

  if (!parsed.success) redirect("/app/characters");

  await deleteCharacter(supabase, user.id, parsed.data.characterId);

  revalidatePath("/app");
  revalidatePath("/app/characters");
  redirect("/app/characters?deleted=1");
}
