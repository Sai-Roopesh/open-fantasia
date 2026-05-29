import { getCurrentUser } from "@/lib/auth";
import { buildSliceResponse } from "@/lib/threads/slice-response";

/**
 * Returns the current authoritative thread slice. Used by the client to
 * reconcile after a streaming turn finishes (where no slice is returned inline)
 * and to poll continuity reconciliation status without a full page refresh.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  return buildSliceResponse(context.supabase, context.user.id, threadId);
}
