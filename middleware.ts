import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Admin production gate + session protection.
 *
 * Production without ENABLE_ADMIN=1 → 404 both /admin and /admin-login.
 * Dev/staging or ENABLE_ADMIN=1 → session validation (redirect to login if needed).
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const adminEnabled =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_ADMIN === "1";

  if (!adminEnabled) {
    return new NextResponse(null, { status: 404 });
  }

  // Admin enabled: enforce session for /admin/* (but allow /admin-login to proceed)
  const isAdminPath =
    req.nextUrl.pathname.startsWith("/admin") &&
    !req.nextUrl.pathname.startsWith("/admin-login");

  if (!isAdminPath) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/admin-login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/admin-login"],
};
