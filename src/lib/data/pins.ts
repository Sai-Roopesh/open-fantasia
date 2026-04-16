import type { ChatPinRecord } from "@/lib/types";
import {
  assertThreadOwnership,
  castRow,
  type DatabaseClient,
} from "@/lib/data/shared";

const pinSelect = [
  "id",
  "thread_id",
  "branch_id",
  "source_message_id",
  "body",
  "status",
  "created_at",
  "updated_at",
].join(", ");

export async function createPin(
  supabase: DatabaseClient,
  userId: string,
  payload: Omit<ChatPinRecord, "id" | "created_at" | "updated_at">,
) {
  await assertThreadOwnership(supabase, userId, payload.thread_id);

  const { data, error } = await supabase
    .from("chat_pins")
    .insert(payload)
    .select(pinSelect)
    .single();

  if (error) throw error;
  return castRow<ChatPinRecord>(data);
}

export async function resolvePin(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
  pinId: string,
) {
  await assertThreadOwnership(supabase, userId, threadId);

  const { data, error } = await supabase
    .from("chat_pins")
    .update({ status: "resolved" })
    .eq("id", pinId)
    .eq("thread_id", threadId)
    .select(pinSelect)
    .single();

  if (error) throw error;
  return castRow<ChatPinRecord>(data);
}
