import { ensureMessageId, toStoredMessage } from "@/lib/ai/message-utils";
import type { DatabaseClient } from "@/lib/data/shared";
import type {
  ChatCheckpointRecord,
  FantasiaUIMessage,
  ThreadRecord,
} from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";

function toJson(value: unknown) {
  return value as Json;
}

function buildReconcileJobPayload(args: {
  thread: ThreadRecord;
  branchId: string;
  checkpointId: string;
  previousCheckpointId: string | null;
  recentMessages: FantasiaUIMessage[];
}) {
  return {
    threadId: args.thread.id,
    branchId: args.branchId,
    checkpointId: args.checkpointId,
    previousCheckpointId: args.previousCheckpointId,
    connectionId: args.thread.connection_id,
    modelId: args.thread.model_id,
    characterId: args.thread.character_id,
    personaId: args.thread.persona_id,
    recentMessageIds: args.recentMessages.map((message) => message.id),
  };
}

function getAutotitleText(message: FantasiaUIMessage | null) {
  if (!message || message.metadata?.hiddenFromTranscript) {
    return null;
  }

  return toStoredMessage(message).content_text;
}

export async function finalizeAssistantTurn(args: {
  supabase: DatabaseClient;
  userId: string;
  thread: ThreadRecord;
  branchId: string;
  parentCheckpointId: string | null;
  userMessage: FantasiaUIMessage;
  assistantMessage: FantasiaUIMessage;
  choiceGroupKey: string;
  recentMessages: FantasiaUIMessage[];
}) {
  const userMessage = ensureMessageId(args.userMessage);
  const assistantMessage = ensureMessageId(args.assistantMessage);
  const recentMessages = args.recentMessages.map((message) => ensureMessageId(message));
  const storedUser = toStoredMessage(userMessage);
  const storedAssistant = toStoredMessage(assistantMessage);

  const { data, error } = await args.supabase.rpc("finalize_turn_and_enqueue_reconcile", {
    p_thread_id: args.thread.id,
    p_user_id: args.userId,
    p_branch_id: args.branchId,
    p_parent_checkpoint_id: args.parentCheckpointId,
    p_choice_group_key: args.choiceGroupKey,
    p_user_message_id: storedUser.id,
    p_user_message_parts: toJson(storedUser.parts),
    p_user_message_content_text: storedUser.content_text,
    p_user_message_metadata: toJson(storedUser.metadata ?? {}),
    p_assistant_message_id: storedAssistant.id,
    p_assistant_message_parts: toJson(storedAssistant.parts),
    p_assistant_message_content_text: storedAssistant.content_text,
    p_assistant_message_metadata: toJson(storedAssistant.metadata ?? {}),
    p_reconcile_payload: toJson(
      buildReconcileJobPayload({
        thread: args.thread,
        branchId: args.branchId,
        checkpointId: "",
        previousCheckpointId: args.parentCheckpointId,
        recentMessages,
      }),
    ),
    p_autotitle_text: getAutotitleText(userMessage),
  });

  if (error) throw error;
  return {
    checkpoint: data as ChatCheckpointRecord,
    storedAssistant,
    storedUser,
  } satisfies {
    checkpoint: ChatCheckpointRecord;
    storedAssistant: { id: string; content_text: string };
    storedUser: { id: string; content_text: string };
  };
}

export async function rewriteCheckpointTurnInPlace(args: {
  supabase: DatabaseClient;
  userId: string;
  thread: ThreadRecord;
  branchId: string;
  checkpoint: ChatCheckpointRecord;
  userMessage?: FantasiaUIMessage | null;
  assistantMessage: FantasiaUIMessage;
  recentMessages: FantasiaUIMessage[];
}) {
  const userMessage = args.userMessage ? ensureMessageId(args.userMessage) : null;
  const assistantMessage = ensureMessageId(args.assistantMessage);
  const recentMessages = args.recentMessages.map((message) => ensureMessageId(message));
  const storedUser = userMessage ? toStoredMessage(userMessage) : null;
  const storedAssistant = toStoredMessage(assistantMessage);

  const { data, error } = await args.supabase.rpc("rewrite_latest_turn_in_place", {
    p_thread_id: args.thread.id,
    p_user_id: args.userId,
    p_branch_id: args.branchId,
    p_checkpoint_id: args.checkpoint.id,
    p_user_message_id: storedUser?.id ?? null,
    p_user_message_parts: storedUser ? toJson(storedUser.parts) : null,
    p_user_message_content_text: storedUser?.content_text ?? null,
    p_user_message_metadata: storedUser ? toJson(storedUser.metadata ?? {}) : null,
    p_assistant_message_id: storedAssistant.id,
    p_assistant_message_parts: toJson(storedAssistant.parts),
    p_assistant_message_content_text: storedAssistant.content_text,
    p_assistant_message_metadata: toJson(storedAssistant.metadata ?? {}),
    p_reconcile_payload: toJson(
      buildReconcileJobPayload({
        thread: args.thread,
        branchId: args.branchId,
        checkpointId: args.checkpoint.id,
        previousCheckpointId: args.checkpoint.parent_checkpoint_id,
        recentMessages,
      }),
    ),
    p_autotitle_text: getAutotitleText(userMessage),
  });

  if (error) throw error;

  return {
    checkpoint: data as ChatCheckpointRecord,
    storedAssistant,
    storedUser,
  } satisfies {
    checkpoint: ChatCheckpointRecord;
    storedAssistant: { id: string; content_text: string };
    storedUser: { id: string; content_text: string } | null;
  };
}
