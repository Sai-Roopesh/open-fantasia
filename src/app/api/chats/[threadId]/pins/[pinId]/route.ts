import { getCurrentUser } from "@/lib/auth";
import { resolvePinForThread } from "@/lib/services/pin-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ threadId: string; pinId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId, pinId } = await params;
  return resolvePinForThread(context.supabase, context.user.id, { threadId, pinId });
}
