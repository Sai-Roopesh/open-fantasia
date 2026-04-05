"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAllowedUser } from "@/lib/auth";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import {
  deleteThread,
  getThread,
  insertTimelineEvent,
  switchActiveBranch,
  updateThreadModel,
  updateThreadPersona,
} from "@/lib/data/threads";

export async function switchThreadModelAction(input: {
  threadId: string;
  connectionId: string;
  modelId: string;
}) {
  const { supabase, user } = await requireAllowedUser();
  const thread = await getThread(supabase, user.id, input.threadId);
  if (!thread) {
    throw new Error("Thread not found.");
  }

  const connection = await getConnection(supabase, user.id, input.connectionId);
  if (!connection) {
    throw new Error("Connection not found.");
  }

  const supportsModel = connection.model_cache.some(
    (model) => model.id === input.modelId,
  );
  if (!supportsModel) {
    throw new Error("The selected model is not cached on that connection.");
  }

  await updateThreadModel(supabase, user.id, input);
  await insertTimelineEvent(supabase, {
    thread_id: input.threadId,
    branch_id: thread.active_branch_id,
    checkpoint_id: null,
    source_message_id: null,
    title: "Model switched",
    detail: `Switched to ${connection.label} using ${input.modelId}.`,
    importance: 2,
  });

  revalidatePath(`/app/chats/${input.threadId}`);
  revalidatePath("/app");
}

export async function switchThreadPersonaAction(input: {
  threadId: string;
  personaId: string;
}) {
  const { supabase, user } = await requireAllowedUser();
  const thread = await getThread(supabase, user.id, input.threadId);
  if (!thread) {
    throw new Error("Thread not found.");
  }

  const persona = await getPersona(supabase, user.id, input.personaId);
  if (!persona) {
    throw new Error("Persona not found.");
  }

  await updateThreadPersona(supabase, user.id, input);
  await insertTimelineEvent(supabase, {
    thread_id: input.threadId,
    branch_id: thread.active_branch_id,
    checkpoint_id: null,
    source_message_id: null,
    title: "Persona switched",
    detail: `Switched the active persona to ${persona.name}.`,
    importance: 2,
  });

  revalidatePath(`/app/chats/${input.threadId}`);
}

export async function switchThreadBranchAction(input: {
  threadId: string;
  branchId: string;
}) {
  const { supabase, user } = await requireAllowedUser();
  const thread = await getThread(supabase, user.id, input.threadId);
  if (!thread) {
    throw new Error("Thread not found.");
  }

  await switchActiveBranch(supabase, user.id, input);
  await insertTimelineEvent(supabase, {
    thread_id: input.threadId,
    branch_id: input.branchId,
    checkpoint_id: null,
    source_message_id: null,
    title: "Branch switched",
    detail: "Moved the active thread view to a different branch.",
    importance: 2,
  });

  revalidatePath(`/app/chats/${input.threadId}`);
}

export async function deleteThreadAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const threadId = String(formData.get("threadId") ?? "").trim();

  if (!threadId) {
    throw new Error("Thread id is required.");
  }

  const thread = await getThread(supabase, user.id, threadId);
  if (!thread) {
    redirect("/app/characters");
  }

  await deleteThread(supabase, user.id, threadId);
  revalidatePath("/app");
  redirect("/app/characters");
}
