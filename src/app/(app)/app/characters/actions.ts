"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import { planCharacterPortraitState } from "@/lib/characters/portraits";
import {
  deleteCharacter,
  getCharacter,
  getCharacterBundle,
  updateCharacterPortrait,
  upsertCharacterBundle,
} from "@/lib/data/characters";
import { getConnection, listConnections } from "@/lib/data/connections";
import { enqueueGenerateCharacterPortraitTask } from "@/lib/data/jobs";
import { getDefaultPersona, getPersona } from "@/lib/data/personas";
import { createThread } from "@/lib/data/threads";
import {
  characterDeleteCommandSchema,
  saveCharacterCommandSchema,
  startThreadCommandSchema,
} from "@/lib/validation";

async function enqueuePortraitJobIfNeeded(args: {
  shouldEnqueue: boolean;
  userId: string;
  characterId: string;
  prompt: string | null;
  seed: number | null;
  sourceHash: string;
  supabase: Awaited<ReturnType<typeof requireAllowedUser>>["supabase"];
}) {
  if (!args.shouldEnqueue || !args.prompt || args.seed === null || !args.sourceHash) {
    return;
  }

  await enqueueGenerateCharacterPortraitTask(args.supabase, {
    userId: args.userId,
    details: {
      characterId: args.characterId,
      prompt: args.prompt,
      seed: args.seed,
      sourceHash: args.sourceHash,
    },
  });
}

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

  const existing = parsed.data.id
    ? await getCharacterBundle(supabase, user.id, parsed.data.id)
    : null;
  const portraitPlan = planCharacterPortraitState({
    existing: existing?.character ?? null,
    input: {
      name: parsed.data.name,
      appearance: parsed.data.appearance,
      core_persona: parsed.data.core_persona,
    },
  });

  const character = await upsertCharacterBundle(supabase, user.id, {
    ...parsed.data,
    ...portraitPlan.nextPortrait,
  });

  await enqueuePortraitJobIfNeeded({
    shouldEnqueue: portraitPlan.shouldEnqueue,
    userId: user.id,
    characterId: character.character.id,
    prompt: portraitPlan.prompt,
    seed: portraitPlan.seed,
    sourceHash: portraitPlan.sourceHash,
    supabase,
  });

  revalidatePath("/app/characters");
  redirect(`/app/characters?edit=${character.character.id}&saved=1`);
}

export async function regenerateCharacterPortraitAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = characterDeleteCommandSchema.safeParse({
    characterId: String(formData.get("id") ?? "").trim(),
  });

  if (!parsed.success) {
    redirect("/app/characters");
  }

  const existing = await getCharacterBundle(supabase, user.id, parsed.data.characterId);
  if (!existing) {
    redirect("/app/characters");
  }

  const portraitPlan = planCharacterPortraitState({
    existing: existing.character,
    input: {
      name: existing.character.name,
      appearance: existing.character.appearance,
      core_persona: existing.character.core_persona,
    },
    forceRegenerate: true,
  });

  await updateCharacterPortrait(
    supabase,
    user.id,
    existing.character.id,
    portraitPlan.nextPortrait,
  );

  await enqueuePortraitJobIfNeeded({
    shouldEnqueue: portraitPlan.shouldEnqueue,
    userId: user.id,
    characterId: existing.character.id,
    prompt: portraitPlan.prompt,
    seed: portraitPlan.seed,
    sourceHash: portraitPlan.sourceHash,
    supabase,
  });

  revalidatePath("/app/characters");
  redirect(`/app/characters?edit=${existing.character.id}`);
}

export async function startThreadAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = startThreadCommandSchema.safeParse({
    characterId: String(formData.get("characterId") ?? ""),
    personaId: String(formData.get("personaId") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    redirect("/app/characters?reason=character");
  }

  const [persona, character] = await Promise.all([
    parsed.data.personaId
      ? getPersona(supabase, user.id, parsed.data.personaId)
      : getDefaultPersona(supabase, user.id),
    getCharacter(supabase, user.id, parsed.data.characterId),
  ]);
  const connections = await listConnections(supabase, user.id);
  const requestedConnection = parsed.data.connectionId
    ? await getConnection(supabase, user.id, parsed.data.connectionId)
    : null;
  const usableConnection =
    requestedConnection ??
    connections.find(
      (connection) =>
        connection.enabled &&
        Boolean(connection.default_model_id) &&
        connection.model_cache.some((model) => model.id === connection.default_model_id),
    ) ??
    null;

  if (!character) {
    redirect("/app/characters?reason=character");
  }

  if (!persona) {
    redirect("/app/personas?reason=default");
  }

  if (!usableConnection) {
    redirect("/app/settings/providers?reason=connection");
  }

  const modelId =
    parsed.data.modelId ??
    usableConnection.default_model_id;
  if (
    !modelId ||
    !usableConnection.model_cache.some((model) => model.id === modelId)
  ) {
    redirect("/app/settings/providers?reason=model");
  }

  const thread = await createThread(supabase, user.id, {
    characterId: parsed.data.characterId,
    connection: usableConnection,
    modelId,
    personaId: persona.id,
    title: `Scene with ${character.name}`,
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
