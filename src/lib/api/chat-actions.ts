export async function throwIfFailed(response: Response, fallback: string) {
  if (response.ok) return;

  let message = fallback;
  try {
    const body = (await response.json()) as { error?: string };
    if (body?.error) message = body.error;
  } catch {
    // response body wasn't JSON — use the fallback
  }
  throw new Error(message);
}

export async function regenerateCheckpoint(threadId: string, checkpointId: string) {
  const response = await fetch(`/api/chats/${threadId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkpointId }),
  });
  await throwIfFailed(response, "Regenerate failed.");
}

export async function rewindCheckpoint(threadId: string, checkpointId: string) {
  const response = await fetch(
    `/api/chats/${threadId}/checkpoints/${checkpointId}/rewind`,
    { method: "POST" },
  );
  await throwIfFailed(response, "Rewind failed.");
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
  await throwIfFailed(response, "Rating failed.");
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
  await throwIfFailed(response, "Edit failed.");
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
  await throwIfFailed(response, "Branch creation failed.");
}

export async function createPin(threadId: string, sourceMessageId: string, body: string) {
  const response = await fetch(`/api/chats/${threadId}/pins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceMessageId, body }),
  });
  await throwIfFailed(response, "Pin failed.");
}

export async function removePin(threadId: string, pinId: string) {
  const response = await fetch(`/api/chats/${threadId}/pins/${pinId}`, {
    method: "DELETE",
  });
  await throwIfFailed(response, "Failed to remove pin.");
}

export async function triggerStarter(threadId: string, starter: string) {
  const response = await fetch(`/api/chats/${threadId}/starter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ starter }),
  });
  await throwIfFailed(response, "Starter generation failed.");
}
