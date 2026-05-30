import { getTextFromMessageParts } from "@/lib/utils/message-text";
import type { FantasiaUIMessage, MessageMetadata } from "@/lib/types";

export function createTextMessage(args: {
  id?: string;
  role: "user" | "assistant" | "system";
  text: string;
  metadata?: MessageMetadata;
}): FantasiaUIMessage {
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
  };
}

export function truncateMessageText(
  message: Pick<FantasiaUIMessage, "parts">,
  length = 120,
) {
  const text = getTextFromMessageParts(message.parts);
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length).trim()}...`;
}
