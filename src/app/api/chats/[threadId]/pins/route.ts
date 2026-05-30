import { getCurrentUser } from "@/lib/auth";
import { createPinForTurn } from "@/lib/services/pin-service";
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

  return createPinForTurn(context.supabase, context.user.id, {
    threadId,
    turnId: parsedBody.data.turnId,
    body: parsedBody.data.body,
  });
}
