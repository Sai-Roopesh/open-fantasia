import { getActiveBranch } from "@/lib/data/branches";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import type { DatabaseClient } from "@/lib/data/shared";
import { insertTimelineEvent } from "@/lib/data/timeline";
import {
  updateThreadBrainModel,
  updateThreadDirectorNotes,
  updateThreadModel,
  updateThreadPersona,
  updateThreadTokens,
} from "@/lib/data/threads";
import { switchBranch } from "@/lib/services/branch-service";
import { buildSlicePatch } from "@/lib/services/slice-service";
import type { MutationResult } from "@/lib/types";

/**
 * Records a settings-change timeline beat against the active branch, then builds
 * the authoritative slice. The active branch is fetched with a lightweight query
 * (not a full assembly load), so a settings change costs one cheap branch read
 * plus one slice build — previously it loaded the full thread twice.
 */
async function commitSettingsChange(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
  branch: { id: string; head_turn_id: string | null },
  event: { title: string; detail: string },
): Promise<MutationResult> {
  await insertTimelineEvent(supabase, {
    thread_id: threadId,
    branch_id: branch.id,
    turn_id: branch.head_turn_id,
    title: event.title,
    detail: event.detail,
    importance: 2,
    event_type: "beat",
    affected_entity_ids: [],
    affected_relationship_ids: [],
  });

  const patch = await buildSlicePatch(supabase, userId, threadId);
  if (!patch) return { ok: false, error: "Thread not found." };
  return { ok: true, slice: patch };
}

export async function switchThreadModel(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; connectionId: string; modelId: string },
): Promise<MutationResult> {
  const branch = await getActiveBranch(supabase, userId, args.threadId);
  if (!branch) return { ok: false, error: "Thread not found." };

  const connection = await getConnection(supabase, userId, args.connectionId);
  if (!connection) return { ok: false, error: "Connection not found." };
  if (!connection.model_cache.some((m) => m.id === args.modelId)) {
    return { ok: false, error: "The selected model is not cached on that connection." };
  }

  await updateThreadModel(supabase, userId, args);
  return commitSettingsChange(supabase, userId, args.threadId, branch, {
    title: "Model switched",
    detail: `Switched to ${connection.label} using ${args.modelId}.`,
  });
}

export async function switchThreadBrainModel(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; connectionId: string | null; modelId: string | null },
): Promise<MutationResult> {
  const branch = await getActiveBranch(supabase, userId, args.threadId);
  if (!branch) return { ok: false, error: "Thread not found." };

  let connectionLabel = "Default Chat Provider";
  if (args.connectionId) {
    const connection = await getConnection(supabase, userId, args.connectionId);
    if (!connection) return { ok: false, error: "Connection not found." };
    if (args.modelId && !connection.model_cache.some((m) => m.id === args.modelId)) {
      return { ok: false, error: "The selected model is not cached on that connection." };
    }
    connectionLabel = connection.label;
  }

  await updateThreadBrainModel(supabase, userId, {
    threadId: args.threadId,
    brainConnectionId: args.connectionId,
    brainModelId: args.modelId,
  });
  return commitSettingsChange(supabase, userId, args.threadId, branch, {
    title: "Brain model switched",
    detail: args.connectionId
      ? `Switched HCE brain to ${connectionLabel} using ${args.modelId}.`
      : "Reset HCE brain to inherit default chat model.",
  });
}

export async function switchThreadPersona(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; personaId: string },
): Promise<MutationResult> {
  const branch = await getActiveBranch(supabase, userId, args.threadId);
  if (!branch) return { ok: false, error: "Thread not found." };

  const persona = await getPersona(supabase, userId, args.personaId);
  if (!persona) return { ok: false, error: "Persona not found." };

  await updateThreadPersona(supabase, userId, args);
  return commitSettingsChange(supabase, userId, args.threadId, branch, {
    title: "Persona switched",
    detail: `Switched the active persona to ${persona.name}.`,
  });
}

export async function switchThreadTokens(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; maxOutputTokens: number },
): Promise<MutationResult> {
  const branch = await getActiveBranch(supabase, userId, args.threadId);
  if (!branch) return { ok: false, error: "Thread not found." };

  await updateThreadTokens(supabase, userId, args);
  return commitSettingsChange(supabase, userId, args.threadId, branch, {
    title: "Response length limit updated",
    detail: `Updated response limit to ${args.maxOutputTokens} tokens.`,
  });
}

export async function switchThreadDirectorNotes(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; directorNotes: string },
): Promise<MutationResult> {
  const branch = await getActiveBranch(supabase, userId, args.threadId);
  if (!branch) return { ok: false, error: "Thread not found." };

  await updateThreadDirectorNotes(supabase, userId, args);
  return commitSettingsChange(supabase, userId, args.threadId, branch, {
    title: "Director notes updated",
    detail: args.directorNotes.trim()
      ? "Updated this thread's director notes."
      : "Cleared this thread's director notes.",
  });
}

/**
 * Branch switching lives in branch-service (it shares the fork/switch timeline
 * semantics). Re-exported here so the chat server actions keep one settings
 * entry point.
 */
export async function switchThreadBranch(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; branchId: string },
): Promise<MutationResult> {
  return switchBranch(supabase, userId, args);
}
