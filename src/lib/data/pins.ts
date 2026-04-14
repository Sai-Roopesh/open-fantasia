import type { ChatPinRecord } from "@/lib/types";
import { castRow, type DatabaseClient } from "@/lib/data/shared";

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
  payload: Omit<ChatPinRecord, "id" | "created_at" | "updated_at">,
) {
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
  pinId: string,
) {
  const { data, error } = await supabase
    .from("chat_pins")
    .update({ status: "resolved" })
    .eq("id", pinId)
    .select(pinSelect)
    .single();

  if (error) throw error;
  return castRow<ChatPinRecord>(data);
}
