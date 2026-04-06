import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv, requireSupabasePublicEnv } from "@/lib/env";
import { isAllowedEmail } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";

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

  const isAppRoute = pathname.startsWith("/app");
  const isLoginRoute = pathname === "/login";
  const allowed = isAllowedEmail(user?.email);

  if (isAppRoute && (!user || !allowed)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("reason", user && !allowed ? "allowlist" : "signin");
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && user && allowed) {
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
