import { buildSnapshotFromReconciliation, reconcileTurnState } from "@/lib/ai/thread-engine";
import type { CharacterBundle } from "@/lib/data/characters";
import { createCheckpoint } from "@/lib/data/checkpoints";
import { persistMessage } from "@/lib/data/messages";
import { updateBranchHead } from "@/lib/data/branches";
import { maybeAutotitleThreadFromMessage } from "@/lib/data/threads";
import { saveSnapshot } from "@/lib/data/snapshots";
import { insertTimelineEvent } from "@/lib/data/timeline";
import { ensureMessageId } from "@/lib/ai/message-utils";
import type {
  ChatCheckpointRecord,
  ConnectionRecord,
  FantasiaUIMessage,
  ThreadRecord,
  ThreadStateSnapshot,
} from "@/lib/types";
import type { DatabaseClient } from "@/lib/data/shared";

export async function finalizeAssistantTurn(args: {
  supabase: DatabaseClient;
  userId: string;
  thread: ThreadRecord;
  branchId: string;
  parentCheckpointId: string | null;
  userMessage: FantasiaUIMessage | null;
  existingUserMessageId?: string;
  assistantMessage: FantasiaUIMessage;
  choiceGroupKey: string;
  previousSnapshot: ThreadStateSnapshot | null;
  connection: ConnectionRecord;
  character: CharacterBundle;
  modelId: string;
  recentMessages: FantasiaUIMessage[];
}) {
  const userMessage = args.userMessage ? ensureMessageId(args.userMessage) : null;
  const assistantMessage = ensureMessageId(args.assistantMessage);
  const recentMessages = args.recentMessages.map((message) => ensureMessageId(message));
  const storedUser = userMessage
    ? await persistMessage(args.supabase, args.thread.id, userMessage)
    : null;
  const storedAssistant = await persistMessage(
    args.supabase,
    args.thread.id,
    assistantMessage,
  );
  const userMessageId = storedUser?.id ?? args.existingUserMessageId ?? null;

  if (!userMessageId || userMessageId.trim().length === 0) {
    throw new Error("Cannot create a checkpoint without a persisted user message id.");
  }

  const checkpoint = await createCheckpoint(args.supabase, {
    thread_id: args.thread.id,
    branch_id: args.branchId,
    parent_checkpoint_id: args.parentCheckpointId,
    user_message_id: userMessageId,
    assistant_message_id: storedAssistant.id,
    choice_group_key: args.choiceGroupKey,
    feedback_rating: null,
    created_by: args.userId,
  });

  if (storedUser && !userMessage?.metadata?.hiddenFromTranscript) {
    await maybeAutotitleThreadFromMessage(
      args.supabase,
      args.userId,
      args.thread,
      storedUser.content_text,
    );
  }

  const reconciliation = await reconcileTurnState({
    connection: args.connection,
    modelId: args.modelId,
    character: args.character,
    previousSnapshot: args.previousSnapshot,
    recentMessages,
  });

  const snapshot = buildSnapshotFromReconciliation({
    checkpointId: checkpoint.id,
    threadId: args.thread.id,
    branchId: args.branchId,
    previousSnapshot: args.previousSnapshot,
    reconciliation,
  });

  await saveSnapshot(args.supabase, snapshot);

  if (reconciliation.timelineEvent) {
    await insertTimelineEvent(args.supabase, {
      thread_id: args.thread.id,
      branch_id: args.branchId,
      checkpoint_id: checkpoint.id,
      source_message_id: storedAssistant.id,
      title: reconciliation.timelineEvent.title,
      detail: reconciliation.timelineEvent.detail,
      importance: reconciliation.timelineEvent.importance,
    });
  }

  await updateBranchHead(args.supabase, args.branchId, checkpoint.id);

  return {
    checkpoint,
    snapshot,
    storedAssistant,
    storedUser,
  } satisfies {
    checkpoint: ChatCheckpointRecord;
    snapshot: ThreadStateSnapshot;
    storedAssistant: { id: string; content_text: string };
    storedUser: { id: string; content_text: string } | null;
  };
}
