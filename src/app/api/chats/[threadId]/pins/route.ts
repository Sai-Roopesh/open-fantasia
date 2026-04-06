import { getCurrentUser } from "@/lib/auth";
import { getThreadGraphView } from "@/lib/data/threads";
import { createPin } from "@/lib/data/pins";
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

  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const pin = await createPin(context.supabase, {
    thread_id: threadId,
    branch_id: threadView.activeBranch.id,
    source_message_id: parsedBody.data.sourceMessageId ?? null,
    body: parsedBody.data.body,
    status: "active",
  });

  return Response.json({ ok: true, pinId: pin.id });
}
