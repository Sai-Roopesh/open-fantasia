"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import { deleteConnection, saveConnection } from "@/lib/data/connections";
import { validateConnectionInput } from "@/lib/ai/catalog";
import type { ProviderId } from "@/lib/types";

export async function saveConnectionAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const provider = String(formData.get("provider") ?? "") as ProviderId;
  const label = String(formData.get("label") ?? "").trim();
  const baseUrl = String(formData.get("base_url") ?? "").trim();
  const apiKey = String(formData.get("api_key") ?? "").trim();
  const enabled = formData.get("enabled") === "on";

  const validationError = validateConnectionInput({ provider, apiKey, baseUrl });
  if (!label || validationError) {
    redirect(
      `/app/settings/providers?reason=${encodeURIComponent(validationError ?? "Connection label is required.")}`,
    );
  }

  await saveConnection(supabase, user.id, {
    id: String(formData.get("id") ?? "").trim() || undefined,
    provider,
    label,
    baseUrl,
    apiKey,
    enabled,
  });

  revalidatePath("/app/settings/providers");
  redirect("/app/settings/providers?saved=1");
}

export async function deleteConnectionAction(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();
  const id = String(formData.get("id") ?? "");
  await deleteConnection(supabase, user.id, id);
  revalidatePath("/app/settings/providers");
  redirect("/app/settings/providers?deleted=1");
}
