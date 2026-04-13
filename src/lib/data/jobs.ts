import type {
  BackgroundJobRecord,
  GenerateCharacterPortraitJobPayload,
  ReconcileCheckpointJobPayload,
} from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";
import {
  castRecord,
  castRows,
  type DatabaseClient,
} from "@/lib/data/shared";
import { backgroundJobRecordSchema } from "@/lib/validation";

const jobSelect = [
  "id",
  "type",
  "status",
  "user_id",
  "thread_id",
  "branch_id",
  "checkpoint_id",
  "payload",
  "attempts",
  "max_attempts",
  "available_at",
  "locked_at",
  "last_error",
  "created_at",
  "updated_at",
].join(", ");

export function normalizeJob(row: Record<string, unknown>) {
  return backgroundJobRecordSchema.parse(row) as BackgroundJobRecord;
}

export async function enqueueReconcileCheckpointJob(
  supabase: DatabaseClient,
  payload: {
    userId: string;
    threadId: string;
    branchId: string;
    checkpointId: string;
    details: ReconcileCheckpointJobPayload;
  },
) {
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      type: "reconcile_checkpoint",
      user_id: payload.userId,
      thread_id: payload.threadId,
      branch_id: payload.branchId,
      checkpoint_id: payload.checkpointId,
      payload: payload.details as Json,
    })
    .select(jobSelect)
    .single();

  if (error) throw error;
  return normalizeJob(castRecord(data, "Background job"));
}

export async function enqueueGenerateCharacterPortraitJob(
  supabase: DatabaseClient,
  payload: {
    userId: string;
    characterId: string;
    details: GenerateCharacterPortraitJobPayload;
  },
) {
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      type: "generate_character_portrait",
      user_id: payload.userId,
      payload: payload.details as Json,
    })
    .select(jobSelect)
    .single();

  if (error) throw error;
  return normalizeJob(castRecord(data, "Background job"));
}

export async function claimPendingJobs(
  supabase: DatabaseClient,
  limit = 5,
) {
  const { data, error } = await supabase.rpc("claim_background_jobs", {
    limit_count: limit,
  });

  if (error) throw error;
  return castRows<unknown>(data, "Background jobs").map((row) =>
    normalizeJob(castRecord(row, "Background job")),
  );
}

export async function completeJob(
  supabase: DatabaseClient,
  jobId: string,
) {
  const { error } = await supabase
    .from("background_jobs")
    .update({
      status: "succeeded",
      locked_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function failJob(
  supabase: DatabaseClient,
  job: BackgroundJobRecord,
  errorMessage: string,
) {
  const nextStatus =
    job.attempts >= job.max_attempts ? "failed" : "pending";
  const availableAt =
    nextStatus === "pending"
      ? new Date(Date.now() + Math.min(job.attempts, 5) * 30_000).toISOString()
      : job.available_at;

  const { error } = await supabase
    .from("background_jobs")
    .update({
      status: nextStatus,
      available_at: availableAt,
      locked_at: null,
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (error) throw error;
}
