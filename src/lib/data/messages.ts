import type {
  FantasiaUIMessage,
  MessageMetadata,
  StoredMessageRecord,
} from "@/lib/types";
import {
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

const validMessageRoles = new Set(["user", "assistant", "system"]);

function normalizeStoredMessage(data: Record<string, unknown>) {
  const role = String(data.role ?? "");
  if (!validMessageRoles.has(role)) {
    throw new Error(`Invalid message role: ${role}`);
  }

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


