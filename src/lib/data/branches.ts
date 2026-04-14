import type { ChatBranchRecord } from "@/lib/types";
import { castRow, type DatabaseClient } from "@/lib/data/shared";

const branchSelect = [
  "id",
  "thread_id",
  "name",
  "parent_branch_id",
  "fork_checkpoint_id",
  "head_checkpoint_id",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

export async function createBranch(
  supabase: DatabaseClient,
  args: {
    threadId: string;
    name: string;
    createdBy: string;
    parentBranchId: string | null;
    forkCheckpointId: string | null;
    headCheckpointId: string | null;
  },
) {
  const { data, error } = await supabase
    .from("chat_branches")
    .insert({
      thread_id: args.threadId,
      name: args.name,
      created_by: args.createdBy,
      parent_branch_id: args.parentBranchId,
      fork_checkpoint_id: args.forkCheckpointId,
      head_checkpoint_id: args.headCheckpointId,
    })
    .select(branchSelect)
    .single();

  if (error) throw error;
  return castRow<ChatBranchRecord>(data);
}
