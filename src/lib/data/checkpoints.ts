import type { ChatCheckpointRecord } from "@/lib/types";
import {
  assertThreadOwnership,
  castRow,
  type DatabaseClient,
} from "@/lib/data/shared";

const checkpointSelect = [
  "id",
  "thread_id",
  "branch_id",
  "parent_checkpoint_id",
  "user_message_id",
  "assistant_message_id",
  "choice_group_key",
  "feedback_rating",
  "created_by",
  "created_at",
].join(", ");

export async function rateCheckpoint(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
  checkpointId: string,
  rating: number,
) {
  await assertThreadOwnership(supabase, userId, threadId);

  const { data, error } = await supabase
    .from("chat_checkpoints")
    .update({ feedback_rating: rating })
    .eq("id", checkpointId)
    .eq("thread_id", threadId)
    .select(checkpointSelect)
    .single();

  if (error) throw error;
  return castRow<ChatCheckpointRecord>(data);
}
