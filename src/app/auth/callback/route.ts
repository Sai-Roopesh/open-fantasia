import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePublicSiteUrl } from "@/lib/env";
import { isAllowedEmail, syncProfile } from "@/lib/auth";

const supportedEmailOtpTypes = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const rawNext = url.searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/app";
  const supabase = await createSupabaseServerClient();
  const siteUrl = requirePublicSiteUrl();

  if ((!code && !tokenHash) || !supabase) {
    return NextResponse.redirect(`${siteUrl}/login?reason=missing+code`);
  }

  let authError = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type && supportedEmailOtpTypes.has(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    authError = error;
  } else {
    authError = new Error("invalid verification payload");
  }

  if (authError) {
    return NextResponse.redirect(
      `${siteUrl}/login?reason=${encodeURIComponent(authError.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${siteUrl}/login?reason=allowlist`);
  }

  await syncProfile(user);
  return NextResponse.redirect(`${siteUrl}${next}`);
}
