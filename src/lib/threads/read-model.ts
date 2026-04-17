import { getTextFromMessageParts } from "@/lib/ai/message-text";
import { toUIMessages } from "@/lib/data/messages";
import type { CharacterBundle } from "@/lib/data/characters";
import { normalizeJob } from "@/lib/data/jobs";
import {
  castRecord,
  castRow,
  castRows,
  type DatabaseClient,
} from "@/lib/data/shared";
import type {
  BackgroundJobRecord,
  ChatBranchRecord,
  ChatCheckpointRecord,
  ChatPinRecord,
  CharacterExampleConversationRecord,
  CharacterRecord,
  CharacterStarterRecord,
  FantasiaUIMessage,
  MessageMetadata,
  StoredMessageRecord,
  ThreadRecord,
  ThreadStateSnapshot,
  TimelineEventRecord,
  TranscriptControl,
} from "@/lib/types";

export type ThreadGraphView = {
  thread: ThreadRecord;
  branches: ChatBranchRecord[];
  activeBranch: ChatBranchRecord;
  checkpoints: ChatCheckpointRecord[];
  latestCheckpoint: ChatCheckpointRecord | null;
  characterBundle: CharacterBundle | null;
  headSnapshot: ThreadStateSnapshot | null;
  headSnapshotPending: boolean;
  headSnapshotFailed: boolean;
  headSnapshotFailureMessage: string | null;
  timeline: TimelineEventRecord[];
  pins: ChatPinRecord[];
  canonicalMessages: FantasiaUIMessage[];
  modelContextMessages: FantasiaUIMessage[];
  controlsByMessageId: Record<string, TranscriptControl>;
};

type ThreadGraphPayload = {
  thread: ThreadRecord;
  activeBranch: ChatBranchRecord;
  branches: ChatBranchRecord[];
  checkpoints: ChatCheckpointRecord[];
  characterBundle: CharacterBundle | null;
  messages: StoredMessageRecord[];
  snapshots: ThreadStateSnapshot[];
  timeline: TimelineEventRecord[];
  pins: ChatPinRecord[];
  latestReconcileJob: BackgroundJobRecord | null;
};

function normalizeStoredMessage(row: Record<string, unknown>) {
  return {
    ...(row as StoredMessageRecord),
    parts: Array.isArray(row.parts) ? row.parts : [],
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as MessageMetadata)
        : null,
  } satisfies StoredMessageRecord;
}

function normalizeSnapshot(row: Record<string, unknown>) {
  return {
    ...(row as ThreadStateSnapshot),
    user_facts: Array.isArray(row.user_facts) ? (row.user_facts as string[]) : [],
    open_loops: Array.isArray(row.open_loops) ? (row.open_loops as string[]) : [],
    resolved_loops: Array.isArray(row.resolved_loops)
      ? (row.resolved_loops as string[])
      : [],
    narrative_hooks: Array.isArray(row.narrative_hooks)
      ? (row.narrative_hooks as string[])
      : [],
    scene_goals: Array.isArray(row.scene_goals) ? (row.scene_goals as string[]) : [],
  } satisfies ThreadStateSnapshot;
}

function normalizeCharacterBundle(value: unknown): CharacterBundle | null {
  if (!value) {
    return null;
  }

  const bundle = castRecord(value, "Thread graph character bundle");
  return {
    character: castRow<CharacterRecord>(
      bundle.character,
      "Thread graph character bundle character",
    ),
    starters: castRows<CharacterStarterRecord>(
      bundle.starters,
      "Thread graph character starters",
    ),
    exampleConversations: castRows<CharacterExampleConversationRecord>(
      bundle.exampleConversations,
      "Thread graph character examples",
    ),
  } satisfies CharacterBundle;
}

function normalizeThreadGraphPayload(value: unknown): ThreadGraphPayload {
  const payload = castRecord(value, "Thread graph payload");

  return {
    thread: castRow<ThreadRecord>(payload.thread, "Thread graph thread"),
    activeBranch: castRow<ChatBranchRecord>(
      payload.activeBranch,
      "Thread graph active branch",
    ),
    branches: castRows<ChatBranchRecord>(payload.branches, "Thread graph branches"),
    checkpoints: castRows<ChatCheckpointRecord>(
      payload.checkpoints,
      "Thread graph checkpoints",
    ),
    characterBundle: normalizeCharacterBundle(payload.characterBundle),
    messages: castRows<Record<string, unknown>>(
      payload.messages,
      "Thread graph messages",
    ).map((row) => normalizeStoredMessage(castRecord(row, "Thread graph message"))),
    snapshots: castRows<Record<string, unknown>>(
      payload.snapshots,
      "Thread graph snapshots",
    ).map((row) => normalizeSnapshot(castRecord(row, "Thread graph snapshot"))),
    timeline: castRows<TimelineEventRecord>(payload.timeline, "Thread graph timeline"),
    pins: castRows<ChatPinRecord>(payload.pins, "Thread graph pins"),
    latestReconcileJob: payload.latestReconcileJob
      ? normalizeJob(castRecord(payload.latestReconcileJob, "Thread graph job"))
      : null,
  };
}

export function resolveSnapshotState(
  checkpoints: ChatCheckpointRecord[],
  snapshotsByCheckpointId: Map<string, ThreadStateSnapshot>,
  latestReconcileJob?: Pick<BackgroundJobRecord, "status" | "last_error"> | null,
) {
  const latestCheckpoint = checkpoints.at(-1) ?? null;
  const headSnapshot = latestCheckpoint
    ? snapshotsByCheckpointId.get(latestCheckpoint.id) ?? null
    : null;
  const headSnapshotFailed = Boolean(
    latestCheckpoint && !headSnapshot && latestReconcileJob?.status === "failed",
  );

  return {
    headSnapshot,
    headSnapshotPending: Boolean(latestCheckpoint && !headSnapshot && !headSnapshotFailed),
    headSnapshotFailed,
    headSnapshotFailureMessage: headSnapshotFailed
      ? latestReconcileJob?.last_error ??
        "Continuity reconciliation failed for the branch head."
      : null,
  };
}

export function buildCheckpointPath(
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

export async function getThreadGraphView(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
): Promise<ThreadGraphView | null> {
  const { data, error } = await supabase.rpc("get_thread_graph_payload", {
    p_user_id: userId,
    p_thread_id: threadId,
  });

  if (error) throw error;
  if (!data) {
    return null;
  }

  const payload = normalizeThreadGraphPayload(data);
  const messagesById = new Map(payload.messages.map((message) => [message.id, message]));
  const snapshotsByCheckpointId = new Map(
    payload.snapshots.map((snapshot) => [snapshot.checkpoint_id, snapshot]),
  );

  const canonicalStoredMessages: StoredMessageRecord[] = [];
  const controlsByMessageId: Record<string, TranscriptControl> = {};

  payload.checkpoints.forEach((checkpoint, index) => {
    const userMessage = messagesById.get(checkpoint.user_message_id);
    const assistantMessage = messagesById.get(checkpoint.assistant_message_id);
    if (!userMessage || !assistantMessage) return;

    const isLatest = index === payload.checkpoints.length - 1;

    if (!userMessage.metadata?.hiddenFromTranscript) {
      controlsByMessageId[userMessage.id] = {
        checkpointId: checkpoint.id,
        branchId: checkpoint.branch_id,
        canEdit: isLatest,
        canRegenerate: false,
        canBranch: true,
        canRewind: true,
        canPin: true,
        canRate: false,
        feedbackRating: checkpoint.feedback_rating,
      };
    }

    controlsByMessageId[assistantMessage.id] = {
      checkpointId: checkpoint.id,
      branchId: checkpoint.branch_id,
      canEdit: false,
      canRegenerate: isLatest,
      canBranch: false,
      canRewind: false,
      canPin: true,
      canRate: true,
      feedbackRating: checkpoint.feedback_rating,
    };

    canonicalStoredMessages.push(userMessage, assistantMessage);
  });

  const reachableCheckpointIds = new Set(payload.checkpoints.map((checkpoint) => checkpoint.id));
  const reachableMessageIds = new Set(canonicalStoredMessages.map((message) => message.id));
  const timeline = payload.timeline
    .filter((event) => {
      if (event.checkpoint_id) return reachableCheckpointIds.has(event.checkpoint_id);
      if (event.source_message_id) return reachableMessageIds.has(event.source_message_id);
      return true;
    })
    .slice(0, 8);
  const pins = payload.pins.filter(
    (pin) => !pin.source_message_id || reachableMessageIds.has(pin.source_message_id),
  );

  const latestCheckpoint = payload.checkpoints.at(-1) ?? null;
  const {
    headSnapshot,
    headSnapshotPending,
    headSnapshotFailed,
    headSnapshotFailureMessage,
  } = resolveSnapshotState(
    payload.checkpoints,
    snapshotsByCheckpointId,
    payload.latestReconcileJob,
  );

  return {
    thread: payload.thread,
    branches: payload.branches,
    activeBranch: payload.activeBranch,
    checkpoints: payload.checkpoints,
    latestCheckpoint,
    characterBundle: payload.characterBundle,
    headSnapshot,
    headSnapshotPending,
    headSnapshotFailed,
    headSnapshotFailureMessage,
    timeline,
    pins,
    canonicalMessages: toUIMessages(canonicalStoredMessages),
    modelContextMessages: toUIMessages(canonicalStoredMessages, { includeHidden: true }),
    controlsByMessageId,
  };
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

export function truncateMessageText(
  message: Pick<FantasiaUIMessage, "parts">,
  length = 120,
) {
  const text = getTextFromMessageParts(message.parts);
  if (text.length <= length) return text;
  return `${text.slice(0, length).trim()}...`;
}
