export type CachePolicy = "precache" | "network_only" | "navigate_with_offline_fallback";

export const OFFLINE_PATH = "/offline";

// Signed-in areas (clinician, client, invite, staff, dev tier) and the API. Nothing under them is ever put in Cache Storage.
export const SIGNED_IN_PREFIXES = ["/app", "/c", "/i", "/ops", "/dev", "/api"] as const;
const NEVER_STORED = new RegExp(`^(?:${SIGNED_IN_PREFIXES.join("|")})(?:/|$)`);
const FONT = /^\/(?:fonts|_next\/static\/media)\/.*\.(?:woff2?|ttf|otf)$/i;
// Production chunks end in a content hash; dev chunks ("…_1igg3k2._.js") keep their name across edits.
const HASHED_STEM = /(?:^|\.)(?=[0-9a-z_-]*\d)[0-9a-z_-]{8,}$/i;

function isHashedStatic(pathname: string): boolean {
  if (!pathname.startsWith("/_next/static/") || pathname.startsWith("/_next/static/development/")) return false;
  const file = pathname.slice(pathname.lastIndexOf("/") + 1);
  const dot = file.lastIndexOf(".");
  return dot > 0 && HASHED_STEM.test(file.slice(0, dot));
}

export function cachePolicy(url: URL | string, origin: string): CachePolicy {
  const u = typeof url === "string" ? new URL(url) : url;
  if (u.origin !== origin) return "network_only";
  const path = u.pathname;
  if (NEVER_STORED.test(path)) return "network_only";
  if (path === OFFLINE_PATH || path.startsWith("/icons/") || path.startsWith("/worklets/") || FONT.test(path) || isHashedStatic(path)) return "precache";
  if (path.startsWith("/_next/") || path === "/sw.js" || path === "/manifest.webmanifest" || path === "/favicon.ico") return "network_only";
  return "navigate_with_offline_fallback";
}
