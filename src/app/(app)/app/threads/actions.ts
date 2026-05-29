"use server";

import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import {
  deleteThread,
  getThread,
  renameThread,
  updateThreadPinnedState,
  updateThreadStatus,
} from "@/lib/data/threads";
import type { ActionResult } from "@/lib/types";
import {
  threadDeleteCommandSchema,
  threadPinnedCommandSchema,
  threadRenameCommandSchema,
  threadStatusCommandSchema,
} from "@/lib/validation";

function revalidateThreadSurfaces(threadId: string) {
  revalidatePath("/app");
  revalidatePath("/app/threads");
  revalidatePath(`/app/chats/${threadId}`);
}

export async function renameThreadAction(input: {
  threadId: string;
  title: string;
}): Promise<ActionResult> {
  const parsed = threadRenameCommandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "A thread id and title are required." };
  }

  const { supabase, user } = await requireAllowedUser();
  await renameThread(supabase, user.id, parsed.data.threadId, parsed.data.title);
  revalidateThreadSurfaces(parsed.data.threadId);
  return { ok: true };
}

export async function setThreadArchiveAction(input: {
  threadId: string;
  status: "active" | "archived";
}): Promise<ActionResult> {
  const parsed = threadStatusCommandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Thread id is required." };
  }

  const { supabase, user } = await requireAllowedUser();
  await updateThreadStatus(supabase, user.id, parsed.data);
  revalidateThreadSurfaces(parsed.data.threadId);
  return { ok: true };
}

export async function setThreadPinnedAction(input: {
  threadId: string;
  pinned: boolean;
}): Promise<ActionResult> {
  const parsed = threadPinnedCommandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Thread id is required." };
  }

  const { supabase, user } = await requireAllowedUser();
  await updateThreadPinnedState(supabase, user.id, parsed.data);
  revalidateThreadSurfaces(parsed.data.threadId);
  return { ok: true };
}

export async function deleteThreadFromListAction(input: {
  threadId: string;
}): Promise<ActionResult> {
  const parsed = threadDeleteCommandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Thread id is required." };
  }

  const { supabase, user } = await requireAllowedUser();
  const thread = await getThread(supabase, user.id, parsed.data.threadId);
  if (!thread) {
    return { ok: true };
  }

  await deleteThread(supabase, user.id, parsed.data.threadId);
  revalidatePath("/app");
  revalidatePath("/app/threads");
  return { ok: true };
}
