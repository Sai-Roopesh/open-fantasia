import { getCurrentUser } from "@/lib/auth";
import { rewriteLatestTurn } from "@/lib/services/generation-service";
import { getValidationErrorMessage, rewriteLatestTurnRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const parsedBody = rewriteLatestTurnRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json(
      {
        error: getValidationErrorMessage(
          parsedBody.error,
          "Fantasia needs the active branch and latest head to rewrite this turn.",
        ),
      },
      { status: 400 },
    );
  }

  return rewriteLatestTurn({
    supabase: context.supabase,
    userId: context.user.id,
    threadId,
    branchId: parsedBody.data.branchId,
    expectedHeadTurnId: parsedBody.data.expectedHeadTurnId,
    mode: parsedBody.data.mode,
    text: "text" in parsedBody.data ? parsedBody.data.text : undefined,
  });
}
