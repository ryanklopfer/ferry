import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { deployTier, isPrelaunch } from "@/server/deploy";

// Reachable signed out. "/x/*" means anything under /x/, never /x itself. Mirrored in src/server/auth/guards.test.ts.
export const PUBLIC_PATHS = [
  "/",
  "/start",
  "/for-clients",
  "/i/*",
  "/legal/*",
  "/offline",
  "/manifest.webmanifest",
  "/sw.js",
  "/worklets/*",
  "/icons/*",
  "/api/webhooks/*",
  "/sign-in",
  "/api/auth/*",
] as const;

// The phone spike's pages: public only in the dev tier, and each route still 404s without this run's key (src/server/dev-spike.ts).
export const DEV_PUBLIC_PATHS = ["/dev/*", "/api/dev/*"] as const;

// Prelaunch (a public host before the real stack exists) serves only the marketing pages and the app shell's
// files; every other path, signed in or not, is a 404.
export const PRELAUNCH_PATHS = ["/", "/for-clients", "/legal/*", "/offline", "/manifest.webmanifest", "/sw.js", "/icons/*"] as const;

const covers = (entry: string, pathname: string) => (entry.endsWith("/*") ? pathname.startsWith(entry.slice(0, -1)) && pathname.length > entry.length - 1 : pathname === entry);

function isDevTier(): boolean {
  try {
    return deployTier() === "dev";
  } catch {
    return false;
  }
}

export function isPublicPath(pathname: string, devTier = isDevTier()): boolean {
  return PUBLIC_PATHS.some((e) => covers(e, pathname)) || (devTier && DEV_PUBLIC_PATHS.some((e) => covers(e, pathname)));
}

// Optimistic only: it checks that a session cookie exists, not that it is valid.
// Pages, routes and actions verify the session against the database.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPrelaunch() && !PRELAUNCH_PATHS.some((e) => covers(e, pathname))) return new NextResponse("Not found", { status: 404 });
  if (isPublicPath(pathname) || getSessionCookie(request)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ code: "unauthorized", message: "Sign in first." }, { status: 401 });
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

// Everything under _next/ is framework assets and the dev hot-reload socket, never app data. Every other path
// reaches the proxy, so PUBLIC_PATHS above is the only allow-list.
export const config = { matcher: ["/((?!_next/|favicon\\.ico$).*)"] };
