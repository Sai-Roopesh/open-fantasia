import { buildSnapshotFromReconciliation, reconcileTurnState } from "@/lib/ai/thread-engine";
import { getCharacterBundle } from "@/lib/data/characters";
import { getConnection } from "@/lib/data/connections";
import { getMessagesByIds, toUIMessages } from "@/lib/data/messages";
import { getPersona } from "@/lib/data/personas";
import { getSnapshot, saveSnapshot } from "@/lib/data/snapshots";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { claimPendingJobs, completeJob, failJob } from "@/lib/data/jobs";
import type { BackgroundJobRecord, JobPayload } from "@/lib/types";
import type { DatabaseClient } from "@/lib/data/shared";
import { jobPayloadSchema } from "@/lib/validation";

export function parseJobPayload(payload: BackgroundJobRecord["payload"]) {
  return jobPayloadSchema.parse(payload) as JobPayload;
}

async function runReconcileCheckpointJob(
  supabase: DatabaseClient,
  job: BackgroundJobRecord,
) {
  const payload = parseJobPayload(job.payload);
  const [connection, character, persona, previousSnapshot, recentMessages] = await Promise.all([
    getConnection(supabase, job.user_id, payload.connectionId),
    getCharacterBundle(supabase, job.user_id, payload.characterId),
    payload.personaId ? getPersona(supabase, job.user_id, payload.personaId) : Promise.resolve(null),
    getPreviousSnapshot(supabase, payload),
    getMessagesByIds(supabase, payload.recentMessageIds),
  ]);

  if (!connection) throw new Error("Reconciliation skipped: connection is missing.");
  if (!character) throw new Error("Reconciliation skipped: character is missing.");
  if (!persona) throw new Error("Reconciliation skipped: persona is missing.");

  const reconciliation = await reconcileTurnState({
    connection,
    modelId: payload.modelId,
    character,
    previousSnapshot,
    recentMessages: toUIMessages(recentMessages, { includeHidden: true }),
  });

  await saveSnapshot(
    supabase,
    buildSnapshotFromReconciliation({
      checkpointId: payload.checkpointId,
      threadId: payload.threadId,
      branchId: payload.branchId,
      previousSnapshot,
      reconciliation,
    }),
  );

  if (reconciliation.timelineEvent) {
    const sourceMessageId = recentMessages.at(-1)?.id ?? null;
    await insertTimelineEvent(supabase, {
      thread_id: payload.threadId,
      branch_id: payload.branchId,
      checkpoint_id: payload.checkpointId,
      source_message_id: sourceMessageId,
      title: reconciliation.timelineEvent.title,
      detail: reconciliation.timelineEvent.detail,
      importance: reconciliation.timelineEvent.importance,
    });
  }
}

async function getPreviousSnapshot(
  supabase: DatabaseClient,
  payload: JobPayload,
) {
  if (!payload.previousCheckpointId) {
    return null;
  }

  return getSnapshot(supabase, payload.previousCheckpointId);
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
      }
      await completeJob(supabase, job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Background job failed.";
      await failJob(supabase, job, message);
    }
  }

  return jobs.length;
}
