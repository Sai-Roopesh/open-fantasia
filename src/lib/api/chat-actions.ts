export async function throwIfFailed(response: Response) {
  if (response.ok) {
    return;
  }

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (body?.error) {
    throw new Error(body.error);
  }

  throw new Error("Action response was malformed.");
}

export async function regenerateTurn(
  threadId: string,
  branchId: string,
  expectedHeadTurnId: string,
) {
  const response = await fetch(`/api/chats/${threadId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, expectedHeadTurnId }),
  });
  await throwIfFailed(response);
}

export async function rewindTurn(threadId: string, turnId: string) {
  const response = await fetch(`/api/chats/${threadId}/turns/${turnId}/rewind`, {
    method: "POST",
  });
  await throwIfFailed(response);
}

export async function rateTurn(threadId: string, turnId: string, rating: number) {
  const response = await fetch(`/api/chats/${threadId}/turns/${turnId}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  await throwIfFailed(response);
}

export async function editLatestTurn(
  threadId: string,
  branchId: string,
  expectedHeadTurnId: string,
  content: string,
) {
  const response = await fetch(`/api/chats/${threadId}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, expectedHeadTurnId, text: content }),
  });
  await throwIfFailed(response);
}

export async function createBranch(
  threadId: string,
  opts: { sourceTurnId: string; name: string; makeActive?: boolean },
) {
  const response = await fetch(`/api/chats/${threadId}/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceTurnId: opts.sourceTurnId,
      name: opts.name,
      makeActive: opts.makeActive ?? true,
    }),
  });
  await throwIfFailed(response);
}

export async function createPin(threadId: string, turnId: string, body: string) {
  const response = await fetch(`/api/chats/${threadId}/pins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turnId, body }),
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
