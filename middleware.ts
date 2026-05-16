import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/** /admin/* 보호. 세션이 없거나 무효면 /admin-login으로 302 리다이렉트. */
export async function middleware(req: NextRequest): Promise<NextResponse> {
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
  matcher: ["/admin/:path*"],
};
