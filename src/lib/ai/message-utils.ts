import type { FantasiaUIMessage, MessageMetadata } from "@/lib/types";

export function getTextFromParts(parts: unknown[]) {
  return parts
    .map((part) => {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

export function toStoredMessage(message: FantasiaUIMessage) {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts,
    content_text: getTextFromParts(message.parts),
    metadata: (message.metadata ?? null) as MessageMetadata | null,
  };
}
