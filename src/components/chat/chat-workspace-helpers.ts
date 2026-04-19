import { buildChatTurnLimitMessage } from "@/lib/chat-limits";

function unwrapTransportErrorMessage(message: string) {
  try {
    const parsed = JSON.parse(message) as { error?: unknown };
    return typeof parsed.error === "string" ? parsed.error : message;
  } catch {
    return message;
  }
}

export function humanizeChatError(message: string) {
  const normalized = unwrapTransportErrorMessage(message);
  const lower = normalized.toLowerCase();
  if (lower.includes("rate limit")) {
    return "That provider lane is rate limited right now. Your draft is still here, so you can retry or switch models without losing the turn.";
  }
  if (lower.includes("unauthorized") || lower.includes("auth")) {
    return "This provider lane rejected the request. Test the connection or refresh the stored key before trying again.";
  }
  if (lower.includes("network")) {
    return "The request fell over before the reply finished streaming. Retry the same draft or switch models if the lane is unstable.";
  }
  if (lower.includes("invalid chat payload")) {
    return buildChatTurnLimitMessage();
  }
  return normalized;
}
