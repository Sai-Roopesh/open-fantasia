import { getCurrentUser } from "@/lib/auth";
import { getConnection, testConnection } from "@/lib/data/connections";
import { connectionRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const context = await getCurrentUser();
  if (!context.supabase || !context.user || !context.isAllowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = connectionRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Missing connectionId" }, { status: 400 });
  }

  const connection = await getConnection(
    context.supabase,
    context.user.id,
    parsed.data.connectionId,
  );

  if (!connection) {
    return Response.json({ error: "Connection not found" }, { status: 404 });
  }

  const updated = await testConnection(context.supabase, connection);
  if (updated.health_status !== "healthy") {
    return Response.json(
      {
        error: updated.health_message,
        status: updated.health_status,
        lastCheckedAt: updated.last_checked_at,
      },
      { status: 400 },
    );
  }

  return Response.json({
    status: updated.health_status,
    message: updated.health_message,
    lastCheckedAt: updated.last_checked_at,
  });
}
