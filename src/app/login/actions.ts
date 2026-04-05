"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { getPublicEnv, hasSupabaseEnv, isLocalDevAuthBypassEnabled } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function canUseLocalMagicLinkBypass(email: string) {
  return isLocalDevAuthBypassEnabled() && isAllowedEmail(email);
}

async function redirectViaLocalMagicLinkBypass(email: string, siteUrl: string) {
  if (!canUseLocalMagicLinkBypass(email)) {
    return false;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return false;
  }

  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (generated.error || !generated.data.properties.hashed_token) {
    return false;
  }

  redirect(
    `${siteUrl}/auth/callback?token_hash=${encodeURIComponent(generated.data.properties.hashed_token)}&type=magiclink`,
  );
}

export async function requestMagicLink(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/login?reason=setup");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const supabase = await createSupabaseServerClient();

  if (!email || !supabase) {
    redirect("/login?reason=invalid");
  }

  const { siteUrl } = getPublicEnv();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("rate limit")) {
      await redirectViaLocalMagicLinkBypass(email, siteUrl);
    }

    redirect(`/login?reason=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?sent=1");
}
