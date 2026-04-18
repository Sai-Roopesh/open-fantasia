import type { ChatPinRecord } from "@/lib/types";
import { parseRow, type DatabaseClient } from "@/lib/data/shared";
import { z } from "zod";

const pinRecordSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  turn_id: z.string().uuid().nullable(),
  body: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const pinSelect = [
  "id",
  "thread_id",
  "branch_id",
  "turn_id",
  "body",
  "status",
  "created_at",
  "updated_at",
].join(", ");

export async function createPin(
  supabase: DatabaseClient,
  _userId: string,
  payload: Omit<ChatPinRecord, "id" | "created_at" | "updated_at">,
) {
  const { data, error } = await supabase
    .from("chat_pins")
    .insert(payload)
    .select(pinSelect)
    .single();

  if (error) {
    throw error;
  }

  return parseRow(data, pinRecordSchema, "Created pin") as ChatPinRecord;
}

export async function resolvePin(
  supabase: DatabaseClient,
  _userId: string,
  threadId: string,
  pinId: string,
) {
  const { data, error } = await supabase
    .from("chat_pins")
    .update({
      status: "resolved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pinId)
    .eq("thread_id", threadId)
    .select(pinSelect)
    .single();

  if (error) {
    throw error;
  }

  return parseRow(data, pinRecordSchema, "Resolved pin") as ChatPinRecord;
}
