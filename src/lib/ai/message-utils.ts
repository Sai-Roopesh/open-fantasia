import type { FantasiaUIMessage, MessageMetadata } from "@/lib/types";
import { getTextFromMessageParts } from "@/lib/ai/message-text";

export function ensureMessageId(message: FantasiaUIMessage): FantasiaUIMessage {
  if (typeof message.id === "string" && message.id.trim().length > 0) {
    return message;
  }

  return {
    ...message,
    id: crypto.randomUUID(),
  };
}

export function toStoredMessage(message: FantasiaUIMessage) {
  const normalized = ensureMessageId(message);

  return {
    id: normalized.id,
    role: normalized.role,
    parts: normalized.parts,
    content_text: getTextFromMessageParts(normalized.parts),
    metadata: (normalized.metadata ?? null) as MessageMetadata | null,
  };
}
