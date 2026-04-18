import { parseRow, parseRows, type DatabaseClient } from "@/lib/data/shared";
import type {
  CharacterPortraitPayload,
  CharacterPortraitTaskRecord,
  TurnReconcileTaskRecord,
} from "@/lib/types";
import {
  portraitTaskRecordSchema,
  reconcileTaskRecordSchema,
} from "@/lib/validation";

function withExponentialBackoff(attempts: number) {
  const exponent = Math.max(0, Math.min(attempts, 6) - 1);
  const baseDelayMs = 30_000 * 2 ** exponent;
  const jitterMs = Math.floor(baseDelayMs * Math.random() * 0.25);
  return new Date(Date.now() + baseDelayMs + jitterMs).toISOString();
}

export function normalizeReconcileTask(value: unknown, label = "Reconcile task") {
  return parseRow(
    value,
    reconcileTaskRecordSchema,
    label,
  ) as TurnReconcileTaskRecord;
}

export function normalizePortraitTask(value: unknown, label = "Portrait task") {
  return parseRow(
    value,
    portraitTaskRecordSchema,
    label,
  ) as CharacterPortraitTaskRecord;
}

export async function enqueueGenerateCharacterPortraitTask(
  supabase: DatabaseClient,
  args: {
    userId: string;
    details: CharacterPortraitPayload;
  },
) {
  const { data, error } = await supabase
    .from("character_portrait_tasks")
    .insert({
      character_id: args.details.characterId,
      user_id: args.userId,
      prompt: args.details.prompt,
      seed: args.details.seed,
      source_hash: args.details.sourceHash,
      status: "pending",
      attempts: 0,
      max_attempts: 8,
      available_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizePortraitTask(data, "Queued portrait task");
}

export async function claimTurnReconcileTasks(
  supabase: DatabaseClient,
  limit = 5,
) {
  const { data, error } = await supabase.rpc("claim_turn_reconcile_tasks", {
    limit_count: limit,
  });

  if (error) {
    throw error;
  }

  return parseRows(
    data ?? [],
    reconcileTaskRecordSchema,
    "Claimed reconcile tasks",
  ) as TurnReconcileTaskRecord[];
}

export async function claimCharacterPortraitTasks(
  supabase: DatabaseClient,
  limit = 2,
) {
  const { data, error } = await supabase.rpc("claim_character_portrait_tasks", {
    limit_count: limit,
  });

  if (error) {
    throw error;
  }

  return parseRows(
    data ?? [],
    portraitTaskRecordSchema,
    "Claimed portrait tasks",
  ) as CharacterPortraitTaskRecord[];
}

export async function completeTurnReconcileTask(
  supabase: DatabaseClient,
  id: string,
) {
  const { error } = await supabase
    .from("turn_reconcile_tasks")
    .update({
      status: "succeeded",
      locked_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function failTurnReconcileTask(
  supabase: DatabaseClient,
  task: TurnReconcileTaskRecord,
  message: string,
) {
  const terminal = task.attempts >= task.max_attempts;
  const { error } = await supabase
    .from("turn_reconcile_tasks")
    .update({
      status: terminal ? "failed" : "pending",
      available_at: terminal ? task.available_at : withExponentialBackoff(task.attempts),
      locked_at: null,
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  if (error) {
    throw error;
  }
}

export async function completeCharacterPortraitTask(
  supabase: DatabaseClient,
  id: string,
) {
  const { error } = await supabase
    .from("character_portrait_tasks")
    .update({
      status: "succeeded",
      locked_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function failCharacterPortraitTask(
  supabase: DatabaseClient,
  task: CharacterPortraitTaskRecord,
  message: string,
) {
  const terminal = task.attempts >= task.max_attempts;
  const { error } = await supabase
    .from("character_portrait_tasks")
    .update({
      status: terminal ? "failed" : "pending",
      available_at: terminal ? task.available_at : withExponentialBackoff(task.attempts),
      locked_at: null,
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  if (error) {
    throw error;
  }
}

export async function cleanupStaleGenerationLocks(
  supabase: DatabaseClient,
  staleBefore = "5 minutes",
) {
  const { data, error } = await supabase.rpc("cleanup_stale_generation_locks", {
    p_stale_before: staleBefore,
  });

  if (error) {
    throw error;
  }

  return Number(data ?? 0);
}
