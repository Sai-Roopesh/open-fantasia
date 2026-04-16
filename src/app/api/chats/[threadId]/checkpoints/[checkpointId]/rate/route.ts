import { getCurrentUser } from "@/lib/auth";
import { rateCheckpoint } from "@/lib/data/checkpoints";
import { getThreadGraphView } from "@/lib/threads/read-model";
import { rateCheckpointRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string; checkpointId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId, checkpointId } = await params;
  const parsedBody = rateCheckpointRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "Rating must be between 1 and 4." }, { status: 400 });
  }

  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const selected = threadView.checkpoints.find((cp) => cp.id === checkpointId);
  if (!selected) {
    return Response.json(
      { error: "Checkpoint not found on the active branch." },
      { status: 404 },
    );
  }

  await rateCheckpoint(
    context.supabase,
    context.user.id,
    threadId,
    checkpointId,
    parsedBody.data.rating,
  );
  return Response.json({ ok: true });
}
