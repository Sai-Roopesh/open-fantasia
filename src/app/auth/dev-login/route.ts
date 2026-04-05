import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { getPublicEnv, isLocalDevAuthBypassEnabled } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const { siteUrl } = getPublicEnv();

  if (!isLocalDevAuthBypassEnabled() || !email || !isAllowedEmail(email)) {
    return NextResponse.redirect(
      `${siteUrl}/login?reason=local+dev+access+is+only+available+for+allowlisted+localhost+sessions`,
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.redirect(`${siteUrl}/login?reason=missing+admin+auth+client`);
  }

  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (generated.error || !generated.data.properties.hashed_token) {
    return NextResponse.redirect(
      `${siteUrl}/login?reason=${encodeURIComponent(generated.error?.message ?? "failed to create localhost dev session")}`,
    );
  }

  return NextResponse.redirect(
    `${siteUrl}/auth/callback?token_hash=${encodeURIComponent(generated.data.properties.hashed_token)}&type=magiclink`,
  );
}
