import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuthed = await verifySessionToken(token);

  const isAppRoute = pathname.startsWith("/app");
  const isLoginRoute = pathname === "/login";

  if (isAppRoute && !isAuthed) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("reason", "signin");
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && isAuthed) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/app";
    appUrl.search = "";
    return NextResponse.redirect(appUrl);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
