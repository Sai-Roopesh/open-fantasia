"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAllowedUser } from "@/lib/auth";
import {
  deleteThread,
  getThread,
  updateThreadPinnedState,
  updateThreadStatus,
  updateThreadTitle,
} from "@/lib/data/threads";

export async function renameThreadAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const threadId = String(formData.get("threadId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!threadId || !title) {
    throw new Error("A thread id and title are required.");
  }

  await updateThreadTitle(supabase, user.id, threadId, title);
  revalidatePath("/app");
  revalidatePath("/app/threads");
  revalidatePath(`/app/chats/${threadId}`);
}

export async function setThreadArchiveAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const threadId = String(formData.get("threadId") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "active") as "active" | "archived";

  if (!threadId) {
    throw new Error("Thread id is required.");
  }

  await updateThreadStatus(supabase, user.id, {
    threadId,
    status: nextStatus,
  });

  revalidatePath("/app");
  revalidatePath("/app/threads");
  revalidatePath(`/app/chats/${threadId}`);

  if (nextStatus === "archived") {
    redirect("/app/threads?status=archived");
  }
}

export async function setThreadPinnedAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const threadId = String(formData.get("threadId") ?? "").trim();
  const pinned = String(formData.get("pinned") ?? "false") === "true";

  if (!threadId) {
    throw new Error("Thread id is required.");
  }

  await updateThreadPinnedState(supabase, user.id, { threadId, pinned });
  revalidatePath("/app");
  revalidatePath("/app/threads");
  revalidatePath(`/app/chats/${threadId}`);
}

export async function deleteThreadFromListAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const threadId = String(formData.get("threadId") ?? "").trim();

  if (!threadId) {
    throw new Error("Thread id is required.");
  }

  const thread = await getThread(supabase, user.id, threadId);
  if (!thread) {
    redirect("/app/threads");
  }

  await deleteThread(supabase, user.id, threadId);
  revalidatePath("/app");
  revalidatePath("/app/threads");
  redirect("/app/threads?deleted=1");
}
