import { createPin, resolvePin } from "@/lib/data/pins";
import type { DatabaseClient } from "@/lib/data/shared";
import { loadThreadAssembly } from "@/lib/services/thread-reader";
import { buildSliceResponse } from "@/lib/services/slice-service";

export async function createPinForTurn(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; turnId: string; body: string },
): Promise<Response> {
  const assembly = await loadThreadAssembly(supabase, userId, args.threadId);
  if (!assembly) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const sourceTurn = assembly.turns.find((turn) => turn.id === args.turnId);
  if (!sourceTurn) {
    return Response.json(
      { error: "Pins can only be created from a visible turn on the active path." },
      { status: 400 },
    );
  }

  await createPin(supabase, userId, {
    thread_id: args.threadId,
    branch_id: assembly.activeBranch.id,
    turn_id: sourceTurn.id,
    body: args.body,
    status: "active",
  });

  return buildSliceResponse(supabase, userId, args.threadId);
}

export async function resolvePinForThread(
  supabase: DatabaseClient,
  userId: string,
  args: { threadId: string; pinId: string },
): Promise<Response> {
  await resolvePin(supabase, userId, args.threadId, args.pinId);
  return buildSliceResponse(supabase, userId, args.threadId);
}
