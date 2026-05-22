"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAllowedUser } from "@/lib/auth";
import {
  deleteThread,
  getThread,
  renameThread,
  updateThreadPinnedState,
  updateThreadStatus,
} from "@/lib/data/threads";
import {
  threadDeleteCommandSchema,
  threadPinnedCommandSchema,
  threadRenameCommandSchema,
  threadStatusCommandSchema,
} from "@/lib/validation";

export async function renameThreadAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = threadRenameCommandSchema.safeParse({
    threadId: String(formData.get("threadId") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("A thread id and title are required.");
  }

  await renameThread(supabase, user.id, parsed.data.threadId, parsed.data.title);
  revalidatePath("/app");
  revalidatePath("/app/threads");
  revalidatePath(`/app/chats/${parsed.data.threadId}`);
}

export async function setThreadArchiveAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = threadStatusCommandSchema.safeParse({
    threadId: String(formData.get("threadId") ?? "").trim(),
    status: String(formData.get("status") ?? "active"),
  });

  if (!parsed.success) {
    throw new Error("Thread id is required.");
  }

  await updateThreadStatus(supabase, user.id, parsed.data);

  revalidatePath("/app");
  revalidatePath("/app/threads");
  revalidatePath(`/app/chats/${parsed.data.threadId}`);

  if (parsed.data.status === "archived") {
    redirect("/app/threads?status=archived");
  }
}

export async function setThreadPinnedAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = threadPinnedCommandSchema.safeParse({
    threadId: String(formData.get("threadId") ?? "").trim(),
    pinned: String(formData.get("pinned") ?? "false") === "true",
  });

  if (!parsed.success) {
    throw new Error("Thread id is required.");
  }

  await updateThreadPinnedState(supabase, user.id, parsed.data);
  revalidatePath("/app");
  revalidatePath("/app/threads");
  revalidatePath(`/app/chats/${parsed.data.threadId}`);
}

export async function deleteThreadFromListAction(formData: FormData) {
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
