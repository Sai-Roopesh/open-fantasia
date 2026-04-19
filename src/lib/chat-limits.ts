export const MAX_CHAT_TURN_TEXT = 12_000;

export function buildChatTurnLimitMessage(limit = MAX_CHAT_TURN_TEXT) {
  return `Chat turns can be up to ${limit.toLocaleString()} characters.`;
}

export function buildChatTurnTrimMessage(
  currentLength: number,
  limit = MAX_CHAT_TURN_TEXT,
) {
  const excess = Math.max(0, currentLength - limit);
  const suffix = excess === 1 ? "" : "s";
  return `${buildChatTurnLimitMessage(limit)} Trim ${excess.toLocaleString()} character${suffix} and send again.`;
}
