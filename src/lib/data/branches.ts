import type { ChatBranchRecord } from "@/lib/types";
import {
  assertThreadOwnership,
  castRow,
  castRows,
  type DatabaseClient,
} from "@/lib/data/shared";

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

export async function listBranches(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
) {
  await assertThreadOwnership(supabase, userId, threadId);

  const { data, error } = await supabase
    .from("chat_branches")
    .select(branchSelect)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return castRows<ChatBranchRecord>(data, "Chat branches");
}

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

export async function updateBranchHead(
  supabase: DatabaseClient,
  branchId: string,
  headCheckpointId: string | null,
) {
  const { data, error } = await supabase
    .from("chat_branches")
    .update({
      head_checkpoint_id: headCheckpointId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", branchId)
    .select(branchSelect)
    .single();

  if (error) throw error;
  return castRow<ChatBranchRecord>(data);
}
