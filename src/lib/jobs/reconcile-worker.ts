import { buildSnapshotFromReconciliation, reconcileTurnState } from "@/lib/ai/thread-engine";
import {
  getCharacter,
  getCharacterBundle,
  updateCharacterPortrait,
} from "@/lib/data/characters";
import {
  buildCharacterPortraitObjectPath,
  CHARACTER_PORTRAITS_BUCKET,
  fetchCharacterPortraitFromPollinations,
} from "@/lib/characters/portraits";
import { getConnection } from "@/lib/data/connections";
import { getMessagesByIds, toUIMessages } from "@/lib/data/messages";
import { getPersona } from "@/lib/data/personas";
import { getSnapshot, saveSnapshot } from "@/lib/data/snapshots";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { claimPendingJobs, completeJob, failJob } from "@/lib/data/jobs";
import type {
  BackgroundJobRecord,
  GenerateCharacterPortraitJobPayload,
  ReconcileCheckpointJobPayload,
} from "@/lib/types";
import type { DatabaseClient } from "@/lib/data/shared";
import {
  generateCharacterPortraitJobPayloadSchema,
  reconcileCheckpointJobPayloadSchema,
} from "@/lib/validation";

export function parseJobPayload(payload: BackgroundJobRecord["payload"]) {
  return reconcileCheckpointJobPayloadSchema.parse(
    payload,
  ) as ReconcileCheckpointJobPayload;
}

export function parseGenerateCharacterPortraitJobPayload(
  payload: BackgroundJobRecord["payload"],
) {
  return generateCharacterPortraitJobPayloadSchema.parse(
    payload,
  ) as GenerateCharacterPortraitJobPayload;
}

export async function reconcileCheckpoint(args: {
  supabase: DatabaseClient;
  userId: string;
  payload: ReconcileCheckpointJobPayload;
}) {
  const [connection, character, persona, previousSnapshot, recentMessages] = await Promise.all([
    getConnection(args.supabase, args.userId, args.payload.connectionId),
    getCharacterBundle(args.supabase, args.userId, args.payload.characterId),
    args.payload.personaId
      ? getPersona(args.supabase, args.userId, args.payload.personaId)
      : Promise.resolve(null),
    getPreviousSnapshot(args.supabase, args.payload),
    getMessagesByIds(args.supabase, args.payload.recentMessageIds),
  ]);

  if (!connection) throw new Error("Reconciliation skipped: connection is missing.");
  if (!character) throw new Error("Reconciliation skipped: character is missing.");
  if (!persona) throw new Error("Reconciliation skipped: persona is missing.");

  const reconciliation = await reconcileTurnState({
    connection,
    modelId: args.payload.modelId,
    character,
    previousSnapshot,
    recentMessages: toUIMessages(recentMessages, { includeHidden: true }),
  });

  await saveSnapshot(
    args.supabase,
    buildSnapshotFromReconciliation({
      checkpointId: args.payload.checkpointId,
      threadId: args.payload.threadId,
      branchId: args.payload.branchId,
      previousSnapshot,
      reconciliation,
    }),
  );

  if (reconciliation.timelineEvent) {
    const sourceMessageId = recentMessages.at(-1)?.id ?? null;
    await insertTimelineEvent(args.supabase, {
      thread_id: args.payload.threadId,
      branch_id: args.payload.branchId,
      checkpoint_id: args.payload.checkpointId,
      source_message_id: sourceMessageId,
      title: reconciliation.timelineEvent.title,
      detail: reconciliation.timelineEvent.detail,
      importance: reconciliation.timelineEvent.importance,
    });
  }
}

async function runReconcileCheckpointJob(
  supabase: DatabaseClient,
  job: BackgroundJobRecord,
) {
  const payload = parseJobPayload(job.payload);

  await reconcileCheckpoint({
    supabase,
    userId: job.user_id,
    payload,
  });
}

async function getPreviousSnapshot(
  supabase: DatabaseClient,
  payload: ReconcileCheckpointJobPayload,
) {
  if (!payload.previousCheckpointId) {
    return null;
  }

  return getSnapshot(supabase, payload.previousCheckpointId);
}

async function runGenerateCharacterPortraitJob(
  supabase: DatabaseClient,
  job: BackgroundJobRecord,
) {
  const payload = parseGenerateCharacterPortraitJobPayload(job.payload);
  const character = await getCharacter(supabase, job.user_id, payload.characterId);

  if (!character) {
    return;
  }

  if (!character.appearance.trim()) {
    await updateCharacterPortrait(supabase, job.user_id, character.id, {
      portrait_status: "idle",
      portrait_path: "",
      portrait_prompt: "",
      portrait_seed: null,
      portrait_source_hash: "",
      portrait_last_error: "",
      portrait_generated_at: null,
    });
    return;
  }

  if (character.portrait_source_hash !== payload.sourceHash) {
    return;
  }

  const image = await fetchCharacterPortraitFromPollinations({
    prompt: payload.prompt,
    seed: payload.seed,
  });
  const path = buildCharacterPortraitObjectPath({
    userId: job.user_id,
    characterId: character.id,
    sourceHash: payload.sourceHash,
    seed: payload.seed,
  });

  const uploadResult = await supabase.storage
    .from(CHARACTER_PORTRAITS_BUCKET)
    .upload(path, image.buffer, {
      upsert: true,
      cacheControl: "31536000",
      contentType: image.contentType,
    });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const { data, error } = await supabase
    .from("characters")
    .update({
      portrait_status: "ready",
      portrait_path: path,
      portrait_prompt: payload.prompt,
      portrait_seed: payload.seed,
      portrait_last_error: "",
      portrait_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", character.id)
    .eq("user_id", job.user_id)
    .eq("portrait_source_hash", payload.sourceHash)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    await supabase.storage.from(CHARACTER_PORTRAITS_BUCKET).remove([path]);
  }
}

async function syncPortraitFailureState(
  supabase: DatabaseClient,
  job: BackgroundJobRecord,
  errorMessage: string,
) {
  if (job.type !== "generate_character_portrait") {
    return;
  }

  try {
    const payload = parseGenerateCharacterPortraitJobPayload(job.payload);
    const character = await getCharacter(supabase, job.user_id, payload.characterId);

    if (!character) {
      return;
    }

    if (character.portrait_source_hash !== payload.sourceHash) {
      return;
    }

    await updateCharacterPortrait(supabase, job.user_id, character.id, {
      portrait_status: job.attempts >= job.max_attempts ? "failed" : "pending",
      portrait_last_error: errorMessage,
    });
  } catch {
    // Best-effort only. The job failure record remains the durable fallback.
  }
}

export async function drainPendingJobs(
  supabase: DatabaseClient,
  limit = 5,
) {
  const jobs = await claimPendingJobs(supabase, limit);

  for (const job of jobs) {
    try {
      if (job.type === "reconcile_checkpoint") {
        await runReconcileCheckpointJob(supabase, job);
      } else if (job.type === "generate_character_portrait") {
        await runGenerateCharacterPortraitJob(supabase, job);
      }
      await completeJob(supabase, job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Background job failed.";
      await syncPortraitFailureState(supabase, job, message);
      await failJob(supabase, job, message);
    }
  }

  return jobs.length;
}
