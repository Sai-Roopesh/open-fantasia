import type { TimelineEventRecord } from "@/lib/types";
import { castRows, type DatabaseClient } from "@/lib/data/shared";

const timelineSelect = [
  "id",
  "thread_id",
  "branch_id",
  "checkpoint_id",
  "source_message_id",
  "title",
  "detail",
  "importance",
  "created_at",
].join(", ");

export async function listTimeline(
  supabase: DatabaseClient,
  threadId: string,
  branchId: string,
  limit = 8,
) {
  const { data, error } = await supabase
    .from("chat_timeline_events")
    .select(timelineSelect)
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return castRows<TimelineEventRecord>(data);
}

export async function insertTimelineEvent(
  supabase: DatabaseClient,
  payload: Omit<TimelineEventRecord, "id" | "created_at">,
) {
  const { error } = await supabase.from("chat_timeline_events").insert(payload);
  if (error) throw error;
}
