"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import { deleteConnection, saveConnection } from "@/lib/data/connections";
import { validateConnectionInput } from "@/lib/ai/catalog";
import { parseFormBoolean, saveConnectionCommandSchema, connectionRequestSchema } from "@/lib/validation";

/**
 * Checks whether a Supabase/Postgres error is a foreign-key violation (23503).
 * `chat_threads.connection_id` references `ai_connections.id` with
 * ON DELETE RESTRICT, so deleting a connection that is still used by a
 * thread is rejected by the database.
 */
function isForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string };
  return candidate.code === "23503";
}

export async function saveConnectionAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = saveConnectionCommandSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    provider: String(formData.get("provider") ?? ""),
    label: String(formData.get("label") ?? "").trim(),
    baseUrl: String(formData.get("base_url") ?? "").trim() || null,
    apiKey: String(formData.get("api_key") ?? "").trim() || null,
    enabled: parseFormBoolean(formData.get("enabled")),
  });

  if (!parsed.success) {
    redirect("/app/settings/providers?reason=Connection+label+is+required.");
  }

  const validationError = validateConnectionInput({
    provider: parsed.data.provider,
    apiKey: parsed.data.apiKey ?? "",
    baseUrl: parsed.data.baseUrl ?? "",
  });
  if (validationError) {
    redirect(
      `/app/settings/providers?reason=${encodeURIComponent(validationError ?? "Connection label is required.")}`,
    );
  }

  let redirectUrl = "/app/settings/providers?saved=1";
  try {
    await saveConnection(supabase, user.id, parsed.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save connection.";
    redirectUrl = `/app/settings/providers?reason=${encodeURIComponent(message)}`;
  }

  revalidatePath("/app/settings/providers");
  redirect(redirectUrl);
}

export async function deleteConnectionAction(formData: FormData) {
  console.log("[deleteConnectionAction] Action started");
  const { supabase, user } = await requireAllowedUser();
  const parsed = connectionRequestSchema.safeParse({
    connectionId: String(formData.get("id") ?? "").trim(),
  });
  if (!parsed.success) {
    console.log("[deleteConnectionAction] Validation failed:", parsed.error);
    redirect("/app/settings/providers");
  }

  console.log("[deleteConnectionAction] Parsed connectionId:", parsed.data.connectionId);
  let redirectUrl = "/app/settings/providers?deleted=1";
  try {
    console.log("[deleteConnectionAction] Calling deleteConnection in DB");
    await deleteConnection(supabase, user.id, parsed.data.connectionId);
    console.log("[deleteConnectionAction] DB delete returned successfully");
  } catch (error) {
    console.error("[deleteConnectionAction] Caught error during delete:", error);
    if (isForeignKeyViolation(error)) {
      console.log("[deleteConnectionAction] Error is foreign-key violation, preparing redirect to reason=constraint");
      redirectUrl =
        "/app/settings/providers?reason=" +
        encodeURIComponent(
          "This connection is still used by one or more threads. " +
            "Switch those threads to a different provider first, then delete this lane.",
        );
    } else {
      const message =
        error instanceof Error ? error.message : "Failed to delete connection.";
      console.log("[deleteConnectionAction] Preparing redirect with error message:", message);
      redirectUrl = `/app/settings/providers?reason=${encodeURIComponent(message)}`;
    }
  }

  console.log("[deleteConnectionAction] Revalidating path and redirecting to:", redirectUrl);
  revalidatePath("/app/settings/providers");
  redirect(redirectUrl);
}

