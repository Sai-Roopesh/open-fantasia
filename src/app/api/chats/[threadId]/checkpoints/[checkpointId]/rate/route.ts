import { getCurrentUser } from "@/lib/auth";
import { getThreadGraphView, rateCheckpoint } from "@/lib/data/threads";

type RateRequest = {
  rating?: number;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string; checkpointId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId, checkpointId } = await params;
  const body = (await request.json()) as RateRequest;
  if (!body.rating || body.rating < 1 || body.rating > 4) {
    return Response.json({ error: "Rating must be between 1 and 4." }, { status: 400 });
  }

  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  await rateCheckpoint(context.supabase, checkpointId, body.rating);
  return Response.json({ ok: true });
}
