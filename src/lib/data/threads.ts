import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChatBranchRecord,
  ChatCheckpointRecord,
  ChatPinRecord,
  ConnectionRecord,
  FantasiaUIMessage,
  MessageMetadata,
  StoredMessageRecord,
  ThreadListItem,
  ThreadRecord,
  ThreadStateSnapshot,
  TimelineEventRecord,
} from "@/lib/types";
import { toStoredMessage } from "@/lib/ai/message-utils";

type TranscriptControl = {
  checkpointId: string;
  branchId: string;
  canEdit: boolean;
  canRegenerate: boolean;
  canBranch: boolean;
  canPin: boolean;
  canRate: boolean;
  feedbackRating: number | null;
  alternates: Array<{
    checkpointId: string;
    selected: boolean;
    label: string;
  }>;
};

export type ThreadGraphView = {
  thread: ThreadRecord;
  branches: ChatBranchRecord[];
  activeBranch: ChatBranchRecord;
  checkpoints: ChatCheckpointRecord[];
  latestCheckpoint: ChatCheckpointRecord | null;
  headSnapshot: ThreadStateSnapshot | null;
  timeline: TimelineEventRecord[];
  pins: ChatPinRecord[];
  canonicalMessages: FantasiaUIMessage[];
  controlsByMessageId: Record<string, TranscriptControl>;
};

function normalizeThread(thread: ThreadRecord) {
  return {
    ...thread,
    archived_at: thread.archived_at ?? null,
    pinned_at: thread.pinned_at ?? null,
  } satisfies ThreadRecord;
}

function sortThreads<T extends ThreadRecord>(threads: T[]) {
  return [...threads].sort((left, right) => {
    const leftPinned = left.pinned_at ? new Date(left.pinned_at).getTime() : 0;
    const rightPinned = right.pinned_at ? new Date(right.pinned_at).getTime() : 0;
    if (leftPinned !== rightPinned) return rightPinned - leftPinned;
    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

export async function listThreads(supabase: SupabaseClient, userId: string) {
  const items = await listThreadItems(supabase, userId, {
    status: "active",
  });
  return items;
}

export async function listThreadItems(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    query?: string;
    status?: "active" | "archived" | "all";
  },
) {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*, characters(name), user_personas(name)")
    .eq("user_id", userId)
    .not("active_branch_id", "is", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  const raw = (data ?? []) as ThreadListItem[];
  const query = options?.query?.trim().toLowerCase() ?? "";
  const status = options?.status ?? "all";

  return sortThreads(
    raw
      .map((thread) => ({
        ...normalizeThread(thread),
        characters: thread.characters ?? null,
        user_personas: thread.user_personas ?? null,
      }))
      .filter((thread) => {
        if (status !== "all" && thread.status !== status) return false;
        if (!query) return true;
        return [thread.title, thread.characters?.name, thread.user_personas?.name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      }),
  );
}

export async function getThread(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("user_id", userId)
    .eq("id", threadId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeThread(data as ThreadRecord) : null;
}

export async function createThread(
  supabase: SupabaseClient,
  userId: string,
  args: {
    characterId: string;
    connection: ConnectionRecord;
    modelId: string;
    title: string;
    personaId: string;
  },
) {
  const { data: inserted, error: threadError } = await supabase
    .from("chat_threads")
    .insert({
      user_id: userId,
      character_id: args.characterId,
      connection_id: args.connection.id,
      model_id: args.modelId,
      title: args.title,
      persona_id: args.personaId,
    })
    .select("*")
    .single();

  if (threadError) throw threadError;

  const { data: branch, error: branchError } = await supabase
    .from("chat_branches")
    .insert({
      thread_id: inserted.id,
      name: "main",
      created_by: userId,
    })
    .select("*")
    .single();

  if (branchError) throw branchError;

  const { data: thread, error: updateError } = await supabase
    .from("chat_threads")
    .update({ active_branch_id: branch.id })
    .eq("id", inserted.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updateError) throw updateError;
  return normalizeThread(thread as ThreadRecord);
}

export async function updateThreadModel(
  supabase: SupabaseClient,
  userId: string,
  args: { threadId: string; connectionId: string; modelId: string },
) {
  const { data, error } = await supabase
    .from("chat_threads")
    .update({
      connection_id: args.connectionId,
      model_id: args.modelId,
    })
    .eq("id", args.threadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeThread(data as ThreadRecord);
}

export async function updateThreadPersona(
  supabase: SupabaseClient,
  userId: string,
  args: { threadId: string; personaId: string },
) {
  const { data, error } = await supabase
    .from("chat_threads")
    .update({ persona_id: args.personaId })
    .eq("id", args.threadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeThread(data as ThreadRecord);
}

export async function switchActiveBranch(
  supabase: SupabaseClient,
  userId: string,
  args: { threadId: string; branchId: string },
) {
  const { data, error } = await supabase
    .from("chat_threads")
    .update({ active_branch_id: args.branchId })
    .eq("id", args.threadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeThread(data as ThreadRecord);
}

export async function listBranches(
  supabase: SupabaseClient,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_branches")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatBranchRecord[];
}

export async function createBranch(
  supabase: SupabaseClient,
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
    .select("*")
    .single();

  if (error) throw error;
  return data as ChatBranchRecord;
}

export async function listMessages(
  supabase: SupabaseClient,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as StoredMessageRecord[];
}

export function toUIMessages(messages: StoredMessageRecord[]): FantasiaUIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: (Array.isArray(message.parts) ? message.parts : []) as FantasiaUIMessage["parts"],
    metadata: {
      ...(message.metadata ?? {}),
      createdAt:
        message.metadata?.createdAt ??
        message.created_at ??
        new Date().toISOString(),
    },
  }));
}

export async function persistMessage(
  supabase: SupabaseClient,
  threadId: string,
  message: FantasiaUIMessage,
) {
  const stored = toStoredMessage({
    ...message,
    metadata: {
      ...(message.metadata ?? {}),
      createdAt:
        message.metadata?.createdAt ??
        new Date().toISOString(),
    },
  });
  const { error } = await supabase.from("chat_messages").upsert({
    id: stored.id,
    thread_id: threadId,
    role: stored.role,
    parts: stored.parts,
    content_text: stored.content_text,
    metadata: stored.metadata,
  });

  if (error) throw error;
  return stored;
}

export async function createCheckpoint(
  supabase: SupabaseClient,
  payload: Omit<ChatCheckpointRecord, "id" | "created_at">,
) {
  const { data, error } = await supabase
    .from("chat_checkpoints")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as ChatCheckpointRecord;
}

export async function updateBranchHead(
  supabase: SupabaseClient,
  branchId: string,
  headCheckpointId: string,
) {
  const { data, error } = await supabase
    .from("chat_branches")
    .update({
      head_checkpoint_id: headCheckpointId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", branchId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ChatBranchRecord;
}

export async function updateThreadTitle(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  title: string,
) {
  const { error } = await supabase
    .from("chat_threads")
    .update({
      title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .eq("user_id", userId);

  if (error) throw error;
  return getThread(supabase, userId, threadId);
}

export async function updateThreadPinnedState(
  supabase: SupabaseClient,
  userId: string,
  args: { threadId: string; pinned: boolean },
) {
  const { data, error } = await supabase
    .from("chat_threads")
    .update({
      pinned_at: args.pinned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.threadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeThread(data as ThreadRecord);
}

export async function updateThreadStatus(
  supabase: SupabaseClient,
  userId: string,
  args: { threadId: string; status: ThreadRecord["status"] },
) {
  const archivedAt = args.status === "archived" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("chat_threads")
    .update({
      status: args.status,
      archived_at: archivedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.threadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeThread(data as ThreadRecord);
}

export async function deleteThread(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
) {
  const { error } = await supabase
    .from("chat_threads")
    .delete()
    .eq("id", threadId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getSnapshot(
  supabase: SupabaseClient,
  checkpointId: string,
) {
  const { data, error } = await supabase
    .from("chat_state_snapshots")
    .select("*")
    .eq("checkpoint_id", checkpointId)
    .maybeSingle();

  if (error) throw error;
  return normalizeSnapshot(data);
}

export async function saveSnapshot(
  supabase: SupabaseClient,
  snapshot: ThreadStateSnapshot,
) {
  const { error } = await supabase.from("chat_state_snapshots").upsert({
    checkpoint_id: snapshot.checkpoint_id,
    thread_id: snapshot.thread_id,
    branch_id: snapshot.branch_id,
    based_on_snapshot_id: snapshot.based_on_snapshot_id,
    scenario_state: snapshot.scenario_state,
    relationship_state: snapshot.relationship_state,
    rolling_summary: snapshot.rolling_summary,
    user_facts: snapshot.user_facts,
    open_loops: snapshot.open_loops,
    scene_goals: snapshot.scene_goals,
    version: snapshot.version,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function listSnapshots(
  supabase: SupabaseClient,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_state_snapshots")
    .select("*")
    .eq("thread_id", threadId);

  if (error) throw error;
  return (data ?? [])
    .map((snapshot) => normalizeSnapshot(snapshot))
    .filter(Boolean) as ThreadStateSnapshot[];
}

export async function listTimeline(
  supabase: SupabaseClient,
  threadId: string,
  branchId: string,
  limit = 8,
) {
  const { data, error } = await supabase
    .from("chat_timeline_events")
    .select("*")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as TimelineEventRecord[];
}

export async function insertTimelineEvent(
  supabase: SupabaseClient,
  payload: Omit<TimelineEventRecord, "id" | "created_at">,
) {
  const { error } = await supabase.from("chat_timeline_events").insert(payload);
  if (error) throw error;
}

export async function listPins(
  supabase: SupabaseClient,
  threadId: string,
  branchId: string,
) {
  const { data, error } = await supabase
    .from("chat_pins")
    .select("*")
    .eq("thread_id", threadId)
    .eq("branch_id", branchId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChatPinRecord[];
}

export async function createPin(
  supabase: SupabaseClient,
  payload: Omit<ChatPinRecord, "id" | "created_at" | "updated_at">,
) {
  const { data, error } = await supabase
    .from("chat_pins")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as ChatPinRecord;
}

export async function resolvePin(
  supabase: SupabaseClient,
  pinId: string,
) {
  const { data, error } = await supabase
    .from("chat_pins")
    .update({ status: "resolved" })
    .eq("id", pinId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ChatPinRecord;
}

export async function rateCheckpoint(
  supabase: SupabaseClient,
  checkpointId: string,
  rating: number,
) {
  const { data, error } = await supabase
    .from("chat_checkpoints")
    .update({ feedback_rating: rating })
    .eq("id", checkpointId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ChatCheckpointRecord;
}

export async function listCheckpoints(
  supabase: SupabaseClient,
  threadId: string,
) {
  const { data, error } = await supabase
    .from("chat_checkpoints")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatCheckpointRecord[];
}

export async function getThreadGraphView(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
): Promise<ThreadGraphView | null> {
  const thread = await getThread(supabase, userId, threadId);
  if (!thread || !thread.active_branch_id) return null;

  const [branches, checkpoints, messages, snapshots] = await Promise.all([
    listBranches(supabase, threadId),
    listCheckpoints(supabase, threadId),
    listMessages(supabase, threadId),
    listSnapshots(supabase, threadId),
  ]);

  const activeBranch = branches.find((branch) => branch.id === thread.active_branch_id);
  if (!activeBranch) return null;

  const checkpointPath = buildCheckpointPath(checkpoints, activeBranch.head_checkpoint_id);
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const snapshotsByCheckpointId = new Map(
    snapshots.map((snapshot) => [snapshot.checkpoint_id, snapshot]),
  );
  const latestCheckpoint = checkpointPath.at(-1) ?? null;
  const choiceGroups = checkpoints.reduce<Record<string, ChatCheckpointRecord[]>>((acc, checkpoint) => {
    (acc[checkpoint.choice_group_key] ??= []).push(checkpoint);
    return acc;
  }, {});

  const canonicalStoredMessages: StoredMessageRecord[] = [];
  const controlsByMessageId: Record<string, TranscriptControl> = {};

  checkpointPath.forEach((checkpoint, index) => {
    const userMessage = messagesById.get(checkpoint.user_message_id);
    const assistantMessage = messagesById.get(checkpoint.assistant_message_id);
    if (!userMessage || !assistantMessage) return;

    const isLatest = index === checkpointPath.length - 1;
    const alternates = (choiceGroups[checkpoint.choice_group_key] ?? [])
      .slice()
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map((option, optionIndex) => ({
        checkpointId: option.id,
        selected: option.id === checkpoint.id,
        label: optionIndex === 0 ? "Base" : `Alt ${optionIndex}`,
      }));

    controlsByMessageId[userMessage.id] = {
      checkpointId: checkpoint.id,
      branchId: checkpoint.branch_id,
      canEdit: isLatest,
      canRegenerate: false,
      canBranch: false,
      canPin: true,
      canRate: false,
      feedbackRating: checkpoint.feedback_rating,
      alternates: [],
    };

    controlsByMessageId[assistantMessage.id] = {
      checkpointId: checkpoint.id,
      branchId: checkpoint.branch_id,
      canEdit: false,
      canRegenerate: isLatest,
      canBranch: true,
      canPin: true,
      canRate: true,
      feedbackRating: checkpoint.feedback_rating,
      alternates: isLatest ? alternates : [],
    };

    canonicalStoredMessages.push(userMessage, assistantMessage);
  });

  const headSnapshot = latestCheckpoint
    ? snapshotsByCheckpointId.get(latestCheckpoint.id) ?? null
    : null;
  const timeline = await listTimeline(supabase, threadId, activeBranch.id, 8);
  const pins = await listPins(supabase, threadId, activeBranch.id);

  return {
    thread,
    branches,
    activeBranch,
    checkpoints: checkpointPath,
    latestCheckpoint,
    headSnapshot,
    timeline,
    pins,
    canonicalMessages: toUIMessages(canonicalStoredMessages),
    controlsByMessageId,
  };
}

export async function selectCheckpointAsBranchHead(
  supabase: SupabaseClient,
  branchId: string,
  checkpointId: string,
) {
  return updateBranchHead(supabase, branchId, checkpointId);
}

function buildCheckpointPath(
  checkpoints: ChatCheckpointRecord[],
  headCheckpointId: string | null,
) {
  if (!headCheckpointId) return [];
  const checkpointsById = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
  const path: ChatCheckpointRecord[] = [];
  let pointer: string | null = headCheckpointId;

  while (pointer) {
    const checkpoint = checkpointsById.get(pointer);
    if (!checkpoint) break;
    path.push(checkpoint);
    pointer = checkpoint.parent_checkpoint_id;
  }

  return path.reverse();
}

function normalizeSnapshot(data: Record<string, unknown> | null) {
  if (!data) return null;

  return {
    ...(data as unknown as ThreadStateSnapshot),
    user_facts: Array.isArray(data.user_facts) ? (data.user_facts as string[]) : [],
    open_loops: Array.isArray(data.open_loops) ? (data.open_loops as string[]) : [],
    scene_goals: Array.isArray(data.scene_goals) ? (data.scene_goals as string[]) : [],
  } satisfies ThreadStateSnapshot;
}

export function createTextMessage(args: {
  id?: string;
  role: "user" | "assistant" | "system";
  text: string;
  metadata?: MessageMetadata;
}) {
  return {
    id: args.id ?? crypto.randomUUID(),
    role: args.role,
    parts: args.text
      ? [
          {
            type: "text" as const,
            text: args.text,
          },
        ]
      : [],
    metadata: args.metadata ?? {},
  } satisfies FantasiaUIMessage;
}
