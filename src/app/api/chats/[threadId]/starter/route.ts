import { getCurrentUser } from "@/lib/auth";
import { generateStarterTurn } from "@/lib/services/generation-service";
import { starterSeedRequestSchema } from "@/lib/validation";

// Headroom for generation plus the background HCE materialization (`after()`).
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const parsedBody = starterSeedRequestSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json({ error: "A starter seed is required." }, { status: 400 });
  }

  return generateStarterTurn({
    supabase: context.supabase,
    userId: context.user.id,
    threadId,
    starter: parsedBody.data.starter,
  });
}
