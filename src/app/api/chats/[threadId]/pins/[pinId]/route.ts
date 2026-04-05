import { getCurrentUser } from "@/lib/auth";
import { resolvePin } from "@/lib/data/threads";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ threadId: string; pinId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pinId } = await params;
  await resolvePin(context.supabase, pinId);
  return Response.json({ ok: true });
}
