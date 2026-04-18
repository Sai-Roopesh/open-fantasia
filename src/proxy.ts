import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv, requireSupabasePublicEnv } from "@/lib/env";
import { isAllowedEmail } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";

async function ensureProfileInProxy(
  supabase: ReturnType<typeof createServerClient<Database>>,
  user: { id: string; email?: string | null },
) {
  const { data: existing, error: loadError } = await supabase
    .from("profiles")
    .select("id, email, is_allowed")
    .eq("id", user.id)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (existing) {
    if (existing.email !== (user.email ?? "")) {
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({
          email: user.email ?? "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("id, email, is_allowed")
        .single();

      if (updateError) {
        throw updateError;
      }

      return updated;
    }

    return existing;
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      is_allowed: isAllowedEmail(user.email),
    })
    .select("id, email, is_allowed")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });
  const { supabaseUrl, supabasePublishableKey } = requireSupabasePublicEnv();

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await ensureProfileInProxy(supabase, user) : null;
  const isAppRoute = pathname.startsWith("/app");
  const isLoginRoute = pathname === "/login";

  if (isAppRoute && (!user || !profile?.is_allowed)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "reason",
      user && !profile?.is_allowed ? "allowlist" : "signin",
    );
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && user && profile?.is_allowed) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/app";
    appUrl.search = "";
    return NextResponse.redirect(appUrl);
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
