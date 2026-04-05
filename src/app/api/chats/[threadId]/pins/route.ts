import { getCurrentUser } from "@/lib/auth";
import { createPin, getThreadGraphView } from "@/lib/data/threads";

type PinRequest = {
  body?: string;
  sourceMessageId?: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const body = (await request.json()) as PinRequest;
  const pinBody = body.body?.trim();
  if (!pinBody) {
    return Response.json({ error: "Pin body is required." }, { status: 400 });
  }

  const threadView = await getThreadGraphView(context.supabase, context.user.id, threadId);
  if (!threadView) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  const pin = await createPin(context.supabase, {
    thread_id: threadId,
    branch_id: threadView.activeBranch.id,
    source_message_id: body.sourceMessageId ?? null,
    body: pinBody,
    status: "active",
  });

  return Response.json({ ok: true, pinId: pin.id });
}
