import { getCurrentUser } from "@/lib/auth";
import { createBranch } from "@/lib/services/branch-service";
import { createBranchRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const parsedBody = createBranchRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "Invalid branch payload." }, { status: 400 });
  }

  return createBranch(context.supabase, context.user.id, {
    threadId,
    sourceTurnId: parsedBody.data.sourceTurnId,
    name: parsedBody.data.name,
    makeActive: parsedBody.data.makeActive,
  });
}
