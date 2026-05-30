import { getCurrentUser } from "@/lib/auth";
import { rewindToTurn } from "@/lib/services/rewind-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ threadId: string; turnId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId, turnId } = await params;
  return rewindToTurn(context.supabase, context.user.id, { threadId, turnId });
}
