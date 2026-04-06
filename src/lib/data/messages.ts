import type { Json } from "@/lib/supabase/database.types";
import { toStoredMessage } from "@/lib/ai/message-utils";
import type {
  FantasiaUIMessage,
  MessageMetadata,
  StoredMessageRecord,
} from "@/lib/types";
import {
  assertThreadOwnership,
  castRecord,
  castRows,
  type DatabaseClient,
} from "@/lib/data/shared";

const messageSelect = [
  "id",
  "thread_id",
  "role",
  "parts",
  "content_text",
  "metadata",
  "created_at",
].join(", ");

function normalizeStoredMessage(data: Record<string, unknown>) {
  return {
    ...(data as StoredMessageRecord),
    parts: Array.isArray(data.parts) ? data.parts : [],
    metadata:
      data.metadata && typeof data.metadata === "object"
        ? (data.metadata as MessageMetadata)
        : null,
  } satisfies StoredMessageRecord;
}

function isHiddenFromTranscript(metadata: MessageMetadata | null | undefined) {
  return Boolean(metadata?.hiddenFromTranscript);
}

export async function listMessages(
  supabase: DatabaseClient,
  userId: string,
  threadId: string,
) {
  await assertThreadOwnership(supabase, userId, threadId);

  const { data, error } = await supabase
    .from("chat_messages")
    .select(messageSelect)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return castRows<unknown>(data).map((row) => normalizeStoredMessage(castRecord(row)));
}

export async function getMessagesByIds(
  supabase: DatabaseClient,
  ids: string[],
) {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("chat_messages")
    .select(messageSelect)
    .in("id", ids);

  if (error) throw error;
  const byId = new Map(
    castRows<Record<string, unknown>>(data).map((row) => [
      String(row.id),
      normalizeStoredMessage(row),
    ]),
  );
  return ids
    .map((id) => byId.get(id))
    .filter((message): message is StoredMessageRecord => Boolean(message));
}

export function toUIMessages(
  messages: StoredMessageRecord[],
  options?: { includeHidden?: boolean },
): FantasiaUIMessage[] {
  const includeHidden = options?.includeHidden ?? false;

  return messages
    .filter((message) => includeHidden || !isHiddenFromTranscript(message.metadata))
    .map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts as FantasiaUIMessage["parts"],
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
  supabase: DatabaseClient,
  threadId: string,
  message: FantasiaUIMessage,
) {
  const stored = toStoredMessage({
    ...message,
    metadata: {
      ...(message.metadata ?? {}),
      createdAt: message.metadata?.createdAt ?? new Date().toISOString(),
    },
  });

  const { error } = await supabase.from("chat_messages").upsert({
    id: stored.id,
    thread_id: threadId,
    role: stored.role,
    parts: stored.parts as Json,
    content_text: stored.content_text,
    metadata: (stored.metadata ?? {}) as Json,
  });

  if (error) throw error;
  return stored;
}
