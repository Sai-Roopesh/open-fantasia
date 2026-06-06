import type { EditableTurnTarget, MutationResult } from "@/lib/types";

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

/**
 * Parse a mutation response into a read-your-writes {@link MutationResult}. Throws
 * on transport/HTTP errors and on a malformed or `ok: false` body so callers can
 * surface the error; on success it returns the authoritative slice.
 */
async function parseMutationResult(response: Response): Promise<MutationResult> {
  await throwIfFailed(response);
  const body = (await response.json().catch(() => null)) as MutationResult | null;
  if (!body || body.ok !== true) {
    throw new Error(
      body && body.ok === false ? body.error : "Action response was malformed.",
    );
  }
  return body;
}

export async function getSlice(threadId: string): Promise<MutationResult> {
  // no-store: the reconcile read must always see the just-committed turn, never a
  // cached transcript (a stale read would blank the streamed reply).
  const response = await fetch(`/api/chats/${threadId}/slice`, {
    method: "GET",
    cache: "no-store",
  });
  return parseMutationResult(response);
}

/** Fetches the active branch's visible transcript as plain text (copy/export). */
export async function getBranchTranscript(threadId: string): Promise<string> {
  const response = await fetch(`/api/chats/${threadId}/transcript`, { method: "GET" });
  await throwIfFailed(response);
  const body = (await response.json().catch(() => null)) as
    | { ok: true; transcript: string }
    | { ok: false; error: string }
    | null;
  if (!body || body.ok !== true) {
    throw new Error(body && body.ok === false ? body.error : "Could not load the transcript.");
  }
  return body.transcript;
}

export async function rewindTurn(threadId: string, turnId: string): Promise<MutationResult> {
  const response = await fetch(`/api/chats/${threadId}/turns/${turnId}/rewind`, {
    method: "POST",
  });
  return parseMutationResult(response);
}

export async function rateTurn(
  threadId: string,
  turnId: string,
  rating: number,
): Promise<MutationResult> {
  const response = await fetch(`/api/chats/${threadId}/turns/${turnId}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  return parseMutationResult(response);
}

export async function rewriteLatestTurn(
  threadId: string,
  payload:
    | {
        branchId: string;
        expectedHeadTurnId: string;
        mode: "regenerate";
      }
    | {
        branchId: string;
        expectedHeadTurnId: string;
        mode: EditableTurnTarget;
        text: string;
      },
): Promise<MutationResult> {
  const response = await fetch(`/api/chats/${threadId}/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseMutationResult(response);
}

export async function createBranch(
  threadId: string,
  opts: { sourceTurnId: string; name: string; makeActive?: boolean },
): Promise<MutationResult> {
  const response = await fetch(`/api/chats/${threadId}/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceTurnId: opts.sourceTurnId,
      name: opts.name,
      makeActive: opts.makeActive ?? true,
    }),
  });
  return parseMutationResult(response);
}

export async function createPin(
  threadId: string,
  turnId: string,
  body: string,
): Promise<MutationResult> {
  const response = await fetch(`/api/chats/${threadId}/pins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turnId, body }),
  });
  return parseMutationResult(response);
}

export async function removePin(threadId: string, pinId: string): Promise<MutationResult> {
  const response = await fetch(`/api/chats/${threadId}/pins/${pinId}`, {
    method: "DELETE",
  });
  return parseMutationResult(response);
}

export async function triggerStarter(
  threadId: string,
  starter: string,
): Promise<MutationResult> {
  const response = await fetch(`/api/chats/${threadId}/starter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ starter }),
  });
  return parseMutationResult(response);
}
