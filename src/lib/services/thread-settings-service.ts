import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import type { DatabaseClient } from "@/lib/data/shared";
import { insertTimelineEvent } from "@/lib/data/timeline";
import {
  switchActiveBranch,
  updateThreadBrainModel,
  updateThreadModel,
  updateThreadPersona,
  updateThreadTokens,
} from "@/lib/data/threads";
import { buildSlicePatch } from "@/lib/services/slice-service";
import { loadThreadAssembly } from "@/lib/services/thread-reader";
import type { MutationResult } from "@/lib/types";

async function buildResult(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
): Promise<MutationResult> {
  const patch = await buildSlicePatch(supabase, userId, threadId);
  if (!patch) return { ok: false, error: "Thread not found." };
  return { ok: true, slice: patch };
}

export async function switchThreadModel(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; connectionId: string; modelId: string },
): Promise<MutationResult> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) return { ok: false, error: "Thread not found." };

  const connection = await getConnection(supabase, userId, args.connectionId);
  if (!connection) return { ok: false, error: "Connection not found." };

  const supportsModel = connection.model_cache.some((m) => m.id === args.modelId);
  if (!supportsModel) return { ok: false, error: "The selected model is not cached on that connection." };

  await updateThreadModel(supabase, userId, args);
  await insertTimelineEvent(supabase, {
    thread_id: args.threadId,
    branch_id: assembly.activeBranch.id,
    turn_id: assembly.activeBranch.head_turn_id ?? null,
    title: "Model switched",
    detail: `Switched to ${connection.label} using ${args.modelId}.`,
    importance: 2,
    event_type: "beat",
    affected_entity_ids: [],
    affected_relationship_ids: [],
  });

  return buildResult(supabase, userId, args.threadId);
}

export async function switchThreadBrainModel(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; connectionId: string | null; modelId: string | null },
): Promise<MutationResult> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) return { ok: false, error: "Thread not found." };

  let connectionLabel = "Default Chat Provider";
  if (args.connectionId) {
    const connection = await getConnection(supabase, userId, args.connectionId);
    if (!connection) return { ok: false, error: "Connection not found." };
    if (args.modelId) {
      const supportsModel = connection.model_cache.some((m) => m.id === args.modelId);
      if (!supportsModel) return { ok: false, error: "The selected model is not cached on that connection." };
    }
    connectionLabel = connection.label;
  }

  await updateThreadBrainModel(supabase, userId, {
    threadId: args.threadId,
    brainConnectionId: args.connectionId,
    brainModelId: args.modelId,
  });
  await insertTimelineEvent(supabase, {
    thread_id: args.threadId,
    branch_id: assembly.activeBranch.id,
    turn_id: assembly.activeBranch.head_turn_id ?? null,
    title: "Brain model switched",
    detail: args.connectionId
      ? `Switched HCE brain to ${connectionLabel} using ${args.modelId}.`
      : "Reset HCE brain to inherit default chat model.",
    importance: 2,
    event_type: "beat",
    affected_entity_ids: [],
    affected_relationship_ids: [],
  });

  return buildResult(supabase, userId, args.threadId);
}

export async function switchThreadPersona(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; personaId: string },
): Promise<MutationResult> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) return { ok: false, error: "Thread not found." };

  const persona = await getPersona(supabase, userId, args.personaId);
  if (!persona) return { ok: false, error: "Persona not found." };

  await updateThreadPersona(supabase, userId, args);
  await insertTimelineEvent(supabase, {
    thread_id: args.threadId,
    branch_id: assembly.activeBranch.id,
    turn_id: assembly.activeBranch.head_turn_id ?? null,
    title: "Persona switched",
    detail: `Switched the active persona to ${persona.name}.`,
    importance: 2,
    event_type: "beat",
    affected_entity_ids: [],
    affected_relationship_ids: [],
  });

  return buildResult(supabase, userId, args.threadId);
}

export async function switchThreadTokens(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; maxOutputTokens: number },
): Promise<MutationResult> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) return { ok: false, error: "Thread not found." };

  await updateThreadTokens(supabase, userId, args);
  await insertTimelineEvent(supabase, {
    thread_id: args.threadId,
    branch_id: assembly.activeBranch.id,
    turn_id: assembly.activeBranch.head_turn_id ?? null,
    title: "Response length limit updated",
    detail: `Updated response limit to ${args.maxOutputTokens} tokens.`,
    importance: 2,
    event_type: "beat",
    affected_entity_ids: [],
    affected_relationship_ids: [],
  });

  return buildResult(supabase, userId, args.threadId);
}

export async function switchThreadBranch(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; branchId: string },
): Promise<MutationResult> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) return { ok: false, error: "Thread not found." };

  await switchActiveBranch(supabase, userId, args);
  return buildResult(supabase, userId, args.threadId);
}
