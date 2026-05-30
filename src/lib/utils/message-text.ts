import type { FantasiaUIMessage } from "@/lib/types";

export function getTextFromMessageParts(parts: unknown[]) {
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

export function getTextFromMessage(message: Pick<FantasiaUIMessage, "parts">) {
  return getTextFromMessageParts(message.parts);
}
