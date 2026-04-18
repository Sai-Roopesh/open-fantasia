"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAllowedUser } from "@/lib/auth";
import { getConnection } from "@/lib/data/connections";
import { getPersona } from "@/lib/data/personas";
import {
  deleteThread,
  getThread,
  switchActiveBranch,
  updateThreadModel,
  updateThreadPersona,
} from "@/lib/data/threads";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { getThreadGraphView } from "@/lib/threads/read-model";
import {
  switchThreadBranchSchema,
  switchThreadModelSchema,
  switchThreadPersonaSchema,
  threadDeleteCommandSchema,
} from "@/lib/validation";

export async function switchThreadModelAction(input: {
  threadId: string;
  connectionId: string;
  modelId: string;
}) {
  const parsed = switchThreadModelSchema.parse(input);
  const { supabase, user } = await requireAllowedUser();
  const view = await getThreadGraphView(supabase, user.id, parsed.threadId);
  if (!view) {
    throw new Error("Thread not found.");
  }

  const connection = await getConnection(supabase, user.id, parsed.connectionId);
  if (!connection) {
    throw new Error("Connection not found.");
  }

  const supportsModel = connection.model_cache.some(
    (model) => model.id === parsed.modelId,
  );
  if (!supportsModel) {
    throw new Error("The selected model is not cached on that connection.");
  }

  await updateThreadModel(supabase, user.id, parsed);
  await insertTimelineEvent(supabase, {
    thread_id: parsed.threadId,
    branch_id: view.activeBranch.id,
    turn_id: view.activeBranch.head_turn_id ?? "",
    title: "Model switched",
    detail: `Switched to ${connection.label} using ${parsed.modelId}.`,
    importance: 2,
  });

  revalidatePath(`/app/chats/${parsed.threadId}`);
  revalidatePath("/app");
}

export async function switchThreadPersonaAction(input: {
  threadId: string;
  personaId: string;
}) {
  const parsed = switchThreadPersonaSchema.parse(input);
  const { supabase, user } = await requireAllowedUser();
  const view = await getThreadGraphView(supabase, user.id, parsed.threadId);
  if (!view) {
    throw new Error("Thread not found.");
  }

  const persona = await getPersona(supabase, user.id, parsed.personaId);
  if (!persona) {
    throw new Error("Persona not found.");
  }

  await updateThreadPersona(supabase, user.id, parsed);
  await insertTimelineEvent(supabase, {
    thread_id: parsed.threadId,
    branch_id: view.activeBranch.id,
    turn_id: view.activeBranch.head_turn_id ?? "",
    title: "Persona switched",
    detail: `Switched the active persona to ${persona.name}.`,
    importance: 2,
  });

  revalidatePath(`/app/chats/${parsed.threadId}`);
}

export async function switchThreadBranchAction(input: {
  threadId: string;
  branchId: string;
}) {
  const parsed = switchThreadBranchSchema.parse(input);
  const { supabase, user } = await requireAllowedUser();
  const thread = await getThread(supabase, user.id, parsed.threadId);
  if (!thread) {
    throw new Error("Thread not found.");
  }

  await switchActiveBranch(supabase, user.id, parsed);

  revalidatePath(`/app/chats/${parsed.threadId}`);
}

export async function deleteThreadAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = threadDeleteCommandSchema.safeParse({
    threadId: String(formData.get("threadId") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Thread id is required.");
  }

  const thread = await getThread(supabase, user.id, parsed.data.threadId);
  if (!thread) {
    redirect("/app/threads");
  }

  await deleteThread(supabase, user.id, parsed.data.threadId);
  revalidatePath("/app");
  revalidatePath("/app/threads");
  redirect("/app/threads?deleted=1");
}
