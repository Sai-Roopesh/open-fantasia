import { rateTurn } from "@/lib/data/turns";
import type { DatabaseClient } from "@/lib/data/shared";
import { loadThreadAssembly } from "@/lib/services/thread-reader";

/**
 * Saves a per-turn feedback rating. A rating changes no world state, messages,
 * or branch structure, so this returns a lightweight ack rather than a full
 * read-your-writes slice — the client holds the rest of the state and updates
 * the rating optimistically.
 */
export async function rateThreadTurn(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; turnId: string; rating: number },
): Promise<Response> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) {
    return Response.json({ ok: false, error: "Thread not found." }, { status: 404 });
  }

  if (!assembly.turns.some((turn) => turn.id === args.turnId)) {
    return Response.json({ ok: false, error: "Turn not found on the active branch." }, { status: 404 });
  }

  await rateTurn(supabase, args.threadId, args.turnId, args.rating);
  return Response.json({ ok: true });
}
