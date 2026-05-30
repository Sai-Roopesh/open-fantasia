import { getCurrentUser } from "@/lib/auth";
import { createPin } from "@/lib/data/pins";
import { loadThreadAssembly } from "@/lib/services/thread-reader";
import { buildSliceResponse } from "@/lib/services/slice-service";
import { createPinRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const parsedBody = createPinRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "Pin body is required." }, { status: 400 });
  }

  const threadView = await loadThreadAssembly(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const sourceTurn = threadView.turns.find((turn) => turn.id === parsedBody.data.turnId);
  if (!sourceTurn) {
    return Response.json(
      { error: "Pins can only be created from a visible turn on the active path." },
      { status: 400 },
    );
  }

  await createPin(context.supabase, context.user.id, {
    thread_id: threadId,
    branch_id: threadView.activeBranch.id,
    turn_id: sourceTurn.id,
    body: parsedBody.data.body,
    status: "active",
  });

  return buildSliceResponse(context.supabase, context.user.id, threadId);
}
