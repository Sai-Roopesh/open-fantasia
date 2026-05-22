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

  try {
    await saveConnection(supabase, user.id, parsed.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save connection.";
    redirect(
      `/app/settings/providers?reason=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath("/app/settings/providers");
  redirect("/app/settings/providers?saved=1");
}

export async function deleteConnectionAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = connectionRequestSchema.safeParse({
    connectionId: String(formData.get("id") ?? "").trim(),
  });
  if (!parsed.success) {
    redirect("/app/settings/providers");
  }

  try {
    await deleteConnection(supabase, user.id, parsed.data.connectionId);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      redirect(
        "/app/settings/providers?reason=" +
          encodeURIComponent(
            "This connection is still used by one or more threads. " +
              "Switch those threads to a different provider first, then delete this lane.",
          ),
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to delete connection.";
    redirect(
      `/app/settings/providers?reason=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath("/app/settings/providers");
  redirect("/app/settings/providers?deleted=1");
}
