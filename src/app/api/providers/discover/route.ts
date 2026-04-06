import { getCurrentUser } from "@/lib/auth";
import { getConnection, refreshConnectionModels } from "@/lib/data/connections";
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

  try {
    const updated = await refreshConnectionModels(context.supabase, connection);
    return Response.json({
      count: updated.model_cache.length,
      status: updated.health_status,
      message: updated.health_message,
      lastCheckedAt: updated.last_checked_at,
      lastModelRefreshAt: updated.last_model_refresh_at,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Model discovery failed.",
      },
      { status: 500 },
    );
  }
}
