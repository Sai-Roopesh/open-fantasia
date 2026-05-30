"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import { getConnection } from "@/lib/data/connections";
import {
  saveConnectionWithValidation,
  deleteConnectionSafely,
} from "@/lib/services/connections";
import {
  parseFormBoolean,
  saveConnectionCommandSchema,
  connectionRequestSchema,
} from "@/lib/validation";

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

  const result = await saveConnectionWithValidation(supabase, user.id, parsed.data);
  if (!result.ok) {
    redirect(`/app/settings/providers?reason=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/app/settings/providers");
  redirect("/app/settings/providers?saved=1");
}

export async function deleteConnectionAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const parsed = connectionRequestSchema.safeParse({
    connectionId: String(formData.get("id") ?? "").trim(),
  });

  if (!parsed.success) redirect("/app/settings/providers");

  // Verify the connection belongs to this user before deleting.
  const connection = await getConnection(supabase, user.id, parsed.data.connectionId);
  if (!connection) redirect("/app/settings/providers");

  const result = await deleteConnectionSafely(supabase, user.id, parsed.data.connectionId);
  if (!result.ok) {
    redirect(`/app/settings/providers?reason=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/app/settings/providers");
  redirect("/app/settings/providers?deleted=1");
}
