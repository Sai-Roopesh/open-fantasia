import { getCurrentUser } from "@/lib/auth";
import { rateThreadTurn } from "@/lib/services/rating-service";
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
  return rateThreadTurn(context.supabase, context.user.id, {
    threadId,
    turnId,
    rating: parsedBody.data.rating,
  });
}
