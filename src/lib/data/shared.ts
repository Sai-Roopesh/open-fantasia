import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ThreadRecord } from "@/lib/types";
import { threadSelect } from "@/lib/data/threads";

export type DatabaseClient = SupabaseClient<Database>;

function assertRecordShape(value: unknown, label: string) {
  if (
    process.env.NODE_ENV !== "production" &&
    (typeof value !== "object" || value === null || Array.isArray(value))
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

// Safety bridge for Supabase row payloads until generated DB types line up end-to-end.
export function castRow<T>(value: unknown, label = "Supabase row") {
  assertRecordShape(value, label);
  return value as T;
}

// Safety bridge for Supabase array payloads until generated DB types line up end-to-end.
export function castRows<T>(value: unknown, label = "Supabase rows") {
  if (
    process.env.NODE_ENV !== "production" &&
    value !== null &&
    value !== undefined &&
    !Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be an array.`);
  }
  return (value ?? []) as T[];
}

// Safety bridge for Supabase JSON payloads until generated DB types line up end-to-end.
export function castRecord(value: unknown, label = "Supabase record") {
  assertRecordShape(value, label);
  return value as Record<string, unknown>;
}

export async function assertThreadOwnership(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_threads")
    .select(threadSelect)
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Thread not found.");
  }

  return castRow<ThreadRecord>(data, "Owned thread");
}
