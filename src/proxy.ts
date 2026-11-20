import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "./lib/auth";

const SESSION_COOKIE = "demo_sid"; // same name as in lib/session.ts (kept here so the proxy has no server-only imports)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * 1. Every page and server action requires the owner password
 *    (except in public demo mode, see lib/auth.ts).
 * 2. Every visitor gets an anonymous demo session id.
 */
export function proxy(request: NextRequest) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="AI Security Assistant", charset="UTF-8"' },
    });
  }

  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (existing && UUID.test(existing)) return NextResponse.next();

  // New visitor: create the id and make it visible to this same request too.
  const id = crypto.randomUUID();
  request.cookies.set(SESSION_COOKIE, id);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days, same as the demo data retention
  });
  return response;
}

export const config = {
  // Everything except Next.js static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
