"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth";
import { deleteConnection, saveConnection } from "@/lib/data/connections";
import { validateConnectionInput } from "@/lib/ai/catalog";
import { parseFormBoolean, saveConnectionCommandSchema } from "@/lib/validation";

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

  await saveConnection(supabase, user.id, parsed.data);

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
