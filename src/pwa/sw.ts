import { cachePolicy, OFFLINE_PATH } from "../core/pwa/cache-policy";
import { APP_ICONS } from "../core/pwa/icons";

// lib.dom has no service worker scope types, and lib.webworker conflicts with it in one program.
type ExtendableEvent = Event & { waitUntil(p: Promise<unknown>): void };
type FetchEvent = ExtendableEvent & { request: Request; respondWith(r: Response | Promise<Response>): void };
type MessageEvent = ExtendableEvent & { data: unknown; ports: readonly MessagePort[] };
type Scope = {
  location: Location;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: "install" | "activate", l: (e: ExtendableEvent) => void): void;
  addEventListener(type: "fetch", l: (e: FetchEvent) => void): void;
  addEventListener(type: "message", l: (e: MessageEvent) => void): void;
};
const sw = self as unknown as Scope;

// Replaced by scripts/pwa/build-sw.ts with a hash of the shell's sources and icons, so any change installs a new
// worker and activate drops the old cache.
declare const __SHELL_VERSION__: string;
const CACHE = `ferry-shell-${__SHELL_VERSION__}`;
const PRECACHE = [OFFLINE_PATH, ...APP_ICONS.map((i) => i.src)];

// The shell is public; fetching it without cookies keeps anything session-specific out of it.
const precacheShell = () => caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((p) => new Request(p, { credentials: "omit" }))));

sw.addEventListener("install", (e) => {
  e.waitUntil(precacheShell().then(() => sw.skipWaiting()));
});

sw.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => sw.clients.claim()),
  );
});

// Next marks only content-hashed build output immutable; in dev nothing under /_next/static is, so dev code is never stale.
const storable = (request: Request, r: Response) =>
  r.ok && r.type === "basic" && (!new URL(request.url).pathname.startsWith("/_next/") || /\bimmutable\b/.test(r.headers.get("cache-control") ?? ""));

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (storable(request, response)) await cache.put(request, response.clone());
  return response;
}

async function navigateWithFallback(e: FetchEvent): Promise<Response> {
  try {
    const response = await fetch(e.request);
    // Sign-out empties Cache Storage, so the next page that loads puts the shell back for the offline fallback.
    e.waitUntil(caches.match(OFFLINE_PATH).then((hit) => (hit ? undefined : precacheShell())).catch(() => {}));
    return response;
  } catch {
    return (await caches.match(OFFLINE_PATH)) ?? Response.error();
  }
}

sw.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const policy = cachePolicy(request.url, sw.location.origin);
  if (policy === "precache") return e.respondWith(cacheFirst(request));
  if (policy === "navigate_with_offline_fallback" && request.mode === "navigate") return e.respondWith(navigateWithFallback(e));
});

// Sign-out: nothing a signed-in session loaded may outlive it on this device.
sw.addEventListener("message", (e) => {
  if ((e.data as { type?: unknown } | null)?.type !== "sign-out") return;
  e.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => e.ports[0]?.postMessage({ type: "cleared" })),
  );
});
