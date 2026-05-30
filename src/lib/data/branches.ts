import { parseRow, parseRows, type DatabaseClient } from "@/lib/data/shared";
import type { ChatBranchRecord } from "@/lib/types";
import { branchRecordSchema } from "@/lib/validation";

const branchSelect = [
  "id",
  "thread_id",
  "name",
  "parent_branch_id",
  "fork_turn_id",
  "head_turn_id",
  "is_active",
  "generation_locked",
  "locked_by_turn_id",
  "locked_at",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

export async function listBranches(
  supabase: DatabaseClient,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_branches")
    .select(branchSelect)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return parseRows(data ?? [], branchRecordSchema, "Branches") as ChatBranchRecord[];
}

/**
 * Lightweight fetch of a thread's active branch id + head, scoped to the owner.
 * Used by cheap mutations that need the branch reference for a timeline event
 * without paying for a full thread assembly load.
 */
export async function getActiveBranch(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
): Promise<{ id: string; head_turn_id: string | null } | null> {
  const { data, error } = await supabase
    .from("chat_branches")
    .select("id, head_turn_id, chat_threads!inner(user_id)")
    .eq("thread_id", threadId)
    .eq("is_active", true)
    .eq("chat_threads.user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? { id: data.id, head_turn_id: data.head_turn_id } : null;
}

export async function createBranchFromTurn(
  supabase: DatabaseClient,
  args: {
    sourceBranchId: string;
    sourceTurnId: string;
    name: string;
    makeActive?: boolean;
  },
) {
  const { data, error } = await supabase.rpc("create_branch_from_turn", {
    p_source_branch_id: args.sourceBranchId,
    p_source_turn_id: args.sourceTurnId,
    p_name: args.name,
    p_make_active: args.makeActive ?? true,
  });

  if (error) {
    throw error;
  }

  return parseRow(data, branchRecordSchema, "Created branch") as ChatBranchRecord;
}

export async function rewindBranchToTurn(
  supabase: DatabaseClient,
  args: {
    branchId: string;
    targetTurnId: string;
    expectedHeadTurnId?: string | null;
  },
) {
  const { data, error } = await supabase.rpc("rewind_branch_to_turn", {
    p_branch_id: args.branchId,
    p_target_turn_id: args.targetTurnId,
    p_expected_head_turn_id: args.expectedHeadTurnId ?? null,
  });

  if (error) {
    throw error;
  }

  return parseRow(data, branchRecordSchema, "Rewound branch") as ChatBranchRecord;
}
