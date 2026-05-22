"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePublicSiteUrl } from "@/lib/env";
import { loginRequestSchema } from "@/lib/validation";

export async function requestMagicLink(formData: FormData) {
  const parsed = loginRequestSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) {
    redirect("/login?reason=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const siteUrl = requirePublicSiteUrl();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?reason=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?sent=1");
}
