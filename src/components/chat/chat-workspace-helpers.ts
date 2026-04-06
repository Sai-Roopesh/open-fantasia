export async function throwIfFailed(response: Response, fallbackMessage: string) {
  if (response.ok) return;
  let payload: { error?: string } | null = null;
  try {
    payload = (await response.json()) as { error?: string };
  } catch {
    payload = null;
  }
  throw new Error(payload?.error ?? fallbackMessage);
}

export function humanizeChatError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit")) {
    return "That provider lane is rate limited right now. Your draft is still here, so you can retry or switch models without losing the turn.";
  }
  if (lower.includes("unauthorized") || lower.includes("auth")) {
    return "This provider lane rejected the request. Test the connection or refresh the stored key before trying again.";
  }
  if (lower.includes("network")) {
    return "The request fell over before the reply finished streaming. Retry the same draft or switch models if the lane is unstable.";
  }
  return message;
}
