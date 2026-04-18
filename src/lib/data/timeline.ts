import type { TimelineEventRecord } from "@/lib/types";
import type { DatabaseClient } from "@/lib/data/shared";

export async function insertTimelineEvent(
  supabase: DatabaseClient,
  payload: Omit<TimelineEventRecord, "id" | "created_at">,
) {
  const { error } = await supabase.from("chat_timeline_events").insert(payload);
  if (error) {
    throw error;
  }
}
