import {
  getCharacterBundle,
  updateCharacterPortrait,
  upsertCharacterBundle,
} from "@/lib/data/characters";
import { getConnection, listConnections } from "@/lib/data/connections";
import { enqueueGenerateCharacterPortraitTask } from "@/lib/data/jobs";
import { getDefaultPersona, getPersona } from "@/lib/data/personas";
import type { DatabaseClient } from "@/lib/data/shared";
import { createThread } from "@/lib/data/threads";
import { scheduleTaskDrain } from "@/lib/jobs/schedule-task-drain";
import {
  planCharacterPortraitState,
  type CharacterPortraitPlan,
} from "@/lib/domain/character-portraits";
import type { CharacterRecord } from "@/lib/types";

type SaveCharacterInput = Omit<Partial<CharacterRecord>, "starters" | "example_conversations"> & {
  id?: string;
  name: string;
  starters: string[];
  exampleConversations: Array<{ user_line: string; character_line: string }>;
};

async function enqueuePortraitJob(
  supabase: DatabaseClient,
  userId: string,
  characterId: string,
  plan: CharacterPortraitPlan,
): Promise<void> {
  if (!plan.shouldEnqueue || !plan.prompt || plan.seed === null || !plan.sourceHash) return;

  await enqueueGenerateCharacterPortraitTask(supabase, {
    userId,
    details: {
      characterId,
      prompt: plan.prompt,
      seed: plan.seed,
      sourceHash: plan.sourceHash,
    },
  });
  scheduleTaskDrain("character-portrait-enqueue", 2);
}

export async function saveCharacterWithPortrait(
  supabase: DatabaseClient,
  userId: string,
  input: SaveCharacterInput,
) {
  const existing = input.id
    ? await getCharacterBundle(supabase, userId, input.id)
    : null;

  const portraitPlan = planCharacterPortraitState({
    existing: existing?.character ?? null,
    input: {
      name: input.name,
      appearance: input.appearance ?? "",
      core_persona: input.core_persona ?? "",
    },
  });

  const characterBundle = await upsertCharacterBundle(supabase, userId, {
    ...input,
    ...portraitPlan.nextPortrait,
  });

  await enqueuePortraitJob(supabase, userId, characterBundle.character.id, portraitPlan);

  return characterBundle;
}

export async function regenerateCharacterPortrait(
  supabase: DatabaseClient,
  userId: string,
  characterId: string,
) {
  const existing = await getCharacterBundle(supabase, userId, characterId);
  if (!existing) return null;

  const portraitPlan = planCharacterPortraitState({
    existing: existing.character,
    input: {
      name: existing.character.name,
      appearance: existing.character.appearance,
      core_persona: existing.character.core_persona,
    },
    forceRegenerate: true,
  });

  await updateCharacterPortrait(supabase, userId, characterId, portraitPlan.nextPortrait);
  await enqueuePortraitJob(supabase, userId, characterId, portraitPlan);

  return existing;
}

type ThreadCreationError = "character" | "persona" | "connection" | "model";

type ThreadCreationContext =
  | {
      character: CharacterRecord;
      persona: Awaited<ReturnType<typeof getDefaultPersona>>;
      connection: Awaited<ReturnType<typeof listConnections>>[number];
      modelId: string;
      brainConnectionId: string | null;
      brainModelId: string | null;
    }
  | { error: ThreadCreationError };

export async function resolveThreadCreationContext(
  supabase: DatabaseClient,
  userId: string,
  params: {
    characterId: string;
    personaId?: string;
    connectionId?: string;
    modelId?: string;
    brainConnectionId: string | null;
    brainModelId: string | null;
  },
): Promise<ThreadCreationContext> {
  const [persona, character, connections] = await Promise.all([
    params.personaId
      ? getPersona(supabase, userId, params.personaId)
      : getDefaultPersona(supabase, userId),
    getCharacterBundle(supabase, userId, params.characterId),
    listConnections(supabase, userId),
  ]);

  const requestedConnection = params.connectionId
    ? await getConnection(supabase, userId, params.connectionId)
    : null;

  const usableConnection =
    requestedConnection ??
    connections.find(
      (c) =>
        c.enabled &&
        Boolean(c.default_model_id) &&
        c.model_cache.some((m) => m.id === c.default_model_id),
    ) ??
    null;

  if (!character) return { error: "character" as const };
  // Persona is optional — a thread can run on the character sheet alone. If the
  // user picked one or has a default it is used; otherwise the thread has none.
  if (!usableConnection) return { error: "connection" as const };

  const resolvedModelId = params.modelId ?? usableConnection.default_model_id;
  if (
    !resolvedModelId ||
    !usableConnection.model_cache.some((m) => m.id === resolvedModelId)
  ) {
    return { error: "model" as const };
  }

  let finalBrainConnectionId = params.brainConnectionId;
  let finalBrainModelId = params.brainModelId;
  if (finalBrainConnectionId) {
    const brainConn = await getConnection(supabase, userId, finalBrainConnectionId);
    if (!brainConn) {
      finalBrainConnectionId = null;
      finalBrainModelId = null;
    } else if (finalBrainModelId) {
      const supportsBrainModel = brainConn.model_cache.some((m) => m.id === finalBrainModelId);
      if (!supportsBrainModel) finalBrainModelId = brainConn.default_model_id;
    } else {
      finalBrainModelId = brainConn.default_model_id;
    }
  }

  return {
    character: character.character,
    persona,
    connection: usableConnection,
    modelId: resolvedModelId,
    brainConnectionId: finalBrainConnectionId,
    brainModelId: finalBrainModelId,
  };
}

export async function startThread(
  supabase: DatabaseClient,
  userId: string,
  params: {
    characterId: string;
    personaId?: string;
    connectionId?: string;
    modelId?: string;
    brainConnectionId: string | null;
    brainModelId: string | null;
  },
): Promise<
  | { ok: true; threadId: string }
  | { ok: false; error: "character" | "persona" | "connection" | "model" }
> {
  const ctx = await resolveThreadCreationContext(supabase, userId, params);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const thread = await createThread(supabase, userId, {
    characterId: params.characterId,
    connection: ctx.connection,
    modelId: ctx.modelId,
    personaId: ctx.persona?.id ?? null,
    brainConnectionId: ctx.brainConnectionId,
    brainModelId: ctx.brainModelId,
    title: `Scene with ${ctx.character.name}`,
  });

  return { ok: true, threadId: thread.id };
}
