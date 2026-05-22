import { getCurrentUser } from "@/lib/auth";
import { rateTurn } from "@/lib/data/turns";
import { getThreadGraphView } from "@/lib/threads/read-model";
import { rateTurnRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string; turnId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = rateTurnRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "A rating from 1 to 4 is required." }, { status: 400 });
  }

  const { threadId, turnId } = await params;
  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  if (!threadView.turns.some((turn) => turn.id === turnId)) {
    return Response.json({ error: "Turn not found on the active branch." }, { status: 404 });
  }

  await rateTurn(context.supabase, threadId, turnId, parsedBody.data.rating);
  return Response.json({ ok: true });
}
