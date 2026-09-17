import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Optimistic only: it checks that a session cookie exists, not that it is valid.
// Pages, routes and actions verify the session against the database.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ code: "unauthorized", message: "Sign in first." }, { status: 401 });
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

// Everything under _next/ is framework assets and the dev hot-reload socket, never app data.
export const config = { matcher: ["/((?!sign-in|api/auth|_next/|favicon.ico).*)"] };
