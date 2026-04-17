export async function throwIfFailed(response: Response) {
  if (response.ok) return;

  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (body?.error) {
    throw new Error(body.error);
  }

  throw new Error("Action response was malformed.");
}

export async function regenerateCheckpoint(threadId: string, checkpointId: string) {
  const response = await fetch(`/api/chats/${threadId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkpointId }),
  });
  await throwIfFailed(response);
}

export async function rewindCheckpoint(threadId: string, checkpointId: string) {
  const response = await fetch(
    `/api/chats/${threadId}/checkpoints/${checkpointId}/rewind`,
    { method: "POST" },
  );
  await throwIfFailed(response);
}

export async function rateCheckpoint(threadId: string, checkpointId: string, rating: number) {
  const response = await fetch(
    `/api/chats/${threadId}/checkpoints/${checkpointId}/rate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    },
  );
  await throwIfFailed(response);
}

export async function editMessage(threadId: string, messageId: string, content: string) {
  const response = await fetch(
    `/api/chats/${threadId}/messages/${messageId}/edit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  await throwIfFailed(response);
}

export async function createBranch(
  threadId: string,
  opts: { checkpointId: string; name: string; makeActive?: boolean },
) {
  const response = await fetch(`/api/chats/${threadId}/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      checkpointId: opts.checkpointId,
      name: opts.name,
      makeActive: opts.makeActive ?? true,
    }),
  });
  await throwIfFailed(response);
}

export async function createPin(threadId: string, sourceMessageId: string, body: string) {
  const response = await fetch(`/api/chats/${threadId}/pins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceMessageId, body }),
  });
  await throwIfFailed(response);
}

export async function removePin(threadId: string, pinId: string) {
  const response = await fetch(`/api/chats/${threadId}/pins/${pinId}`, {
    method: "DELETE",
  });
  await throwIfFailed(response);
}

export async function triggerStarter(threadId: string, starter: string) {
  const response = await fetch(`/api/chats/${threadId}/starter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ starter }),
  });
  await throwIfFailed(response);
}
