"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAllowedUser } from "@/lib/auth";
import { getThread, deleteThread } from "@/lib/data/threads";
import type { MutationResult } from "@/lib/types";
import {
  switchThreadModel,
  switchThreadBrainModel,
  switchThreadPersona,
  switchThreadTokens,
  switchThreadDirectorNotes,
  switchThreadBranch,
} from "@/lib/services/thread-settings-service";
import {
  switchThreadBranchSchema,
  switchThreadModelSchema,
  switchThreadBrainModelSchema,
  switchThreadPersonaSchema,
  threadDeleteCommandSchema,
  updateThreadTokensSchema,
  updateThreadDirectorNotesSchema,
} from "@/lib/validation";

export async function switchThreadModelAction(input: {
  threadId: string;
  connectionId: string;
  modelId: string;
}): Promise<MutationResult> {
  const parsed = switchThreadModelSchema.parse(input);
  const { supabase, user } = await requireAllowedUser();
  const result = await switchThreadModel(supabase, user.id, parsed);
  if (result.ok) {
    revalidatePath(`/app/chats/${parsed.threadId}`);
    revalidatePath("/app");
  }
  return result;
}

export async function switchThreadBrainModelAction(input: {
  threadId: string;
  connectionId: string | null;
  modelId: string | null;
}): Promise<MutationResult> {
  const parsed = switchThreadBrainModelSchema.parse(input);
  const { supabase, user } = await requireAllowedUser();
  const result = await switchThreadBrainModel(supabase, user.id, parsed);
  if (result.ok) {
    revalidatePath(`/app/chats/${parsed.threadId}`);
    revalidatePath("/app");
  }
  return result;
}

export async function switchThreadTokensAction(input: {
  threadId: string;
  maxOutputTokens: number;
}): Promise<MutationResult> {
  const parsed = updateThreadTokensSchema.parse(input);
  const { supabase, user } = await requireAllowedUser();
  const result = await switchThreadTokens(supabase, user.id, parsed);
  if (result.ok) {
    revalidatePath(`/app/chats/${parsed.threadId}`);
    revalidatePath("/app");
  }
  return result;
}

export async function switchThreadDirectorNotesAction(input: {
  threadId: string;
  directorNotes: string;
}): Promise<MutationResult> {
  const parsed = updateThreadDirectorNotesSchema.parse(input);
  const { supabase, user } = await requireAllowedUser();
  const result = await switchThreadDirectorNotes(supabase, user.id, parsed);
  if (result.ok) {
    revalidatePath(`/app/chats/${parsed.threadId}`);
    revalidatePath("/app");
  }
  return result;
}

export async function switchThreadPersonaAction(input: {
  threadId: string;
  personaId: string;
}): Promise<MutationResult> {
  const parsed = switchThreadPersonaSchema.parse(input);
  const { supabase, user } = await requireAllowedUser();
  const result = await switchThreadPersona(supabase, user.id, parsed);
  if (result.ok) {
    revalidatePath(`/app/chats/${parsed.threadId}`);
  }
  return result;
}

export async function switchThreadBranchAction(input: {
  threadId: string;
  branchId: string;
}): Promise<MutationResult> {
  const parsed = switchThreadBranchSchema.parse(input);
  const { supabase, user } = await requireAllowedUser();
  const result = await switchThreadBranch(supabase, user.id, parsed);
  if (result.ok) {
    revalidatePath(`/app/chats/${parsed.threadId}`);
  }
  return result;
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
