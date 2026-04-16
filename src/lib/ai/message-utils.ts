import type { FantasiaUIMessage, MessageMetadata } from "@/lib/types";
import { getTextFromMessageParts } from "@/lib/ai/message-text";

/**
 * Always assigns a fresh server-generated UUID, ignoring any client-supplied ID.
 * This prevents crafted requests from reusing an existing chat_messages.id
 * to silently mutate historical transcript rows across threads.
 *
 * Only use this for NEW messages entering the system (e.g. the chat route).
 * For rewrite-in-place paths where messages already exist with checkpoint-owned IDs,
 * the caller should preserve the existing ID directly.
 */
export function assignServerMessageId(message: FantasiaUIMessage): FantasiaUIMessage {
  return {
    ...message,
    id: crypto.randomUUID(),
  };
}

/**
 * Converts a UI message to its stored representation.
 * The caller is responsible for ensuring the message has a correct ID
 * (via assignServerMessageId for new messages, or from the checkpoint for rewrites).
 */
export function toStoredMessage(message: FantasiaUIMessage) {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts,
    content_text: getTextFromMessageParts(message.parts),
    metadata: (message.metadata ?? null) as MessageMetadata | null,
  };
}
