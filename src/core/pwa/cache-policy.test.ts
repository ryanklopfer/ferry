import { describe, expect, it } from "vitest";
import { cachePolicy } from "./cache-policy";

const ORIGIN = "https://ferry.example";
const policy = (path: string) => cachePolicy(new URL(path, ORIGIN), ORIGIN);

describe("cachePolicy", () => {
  it.each([
    "/app",
    "/app/",
    "/app/clients/c_1",
    "/app/notes/n_1?_rsc=1a2b",
    "/c",
    "/c/trips/t_1",
    "/i",
    "/i/tok_abc",
    "/api",
    "/api/v1/claims",
    "/api/auth/get-session",
    "/app/static/0f3a9c1b2d4e5f60.js",
    "/api/fonts/x.woff2",
    "/c/icons/x.png",
    "/i/worklets/pcm.js",
  ])("%s is network_only", (path) => {
    expect(policy(path)).toBe("network_only");
  });

  it.each([
    "/offline",
    "/_next/static/chunks/310vm2bl3xxpt.js",
    "/_next/static/chunks/turbopack-0fd4kydcax3qk.js",
    "/_next/static/chunks/41y1gbimh8m9c.css",
    "/_next/static/chunks/main-app-1a2b3c4d5e6f7a8b.js",
    "/_next/static/media/caa3a2e1cccd8315-s.p.0wgildi0cnwt9.woff2",
    "/fonts/bricolage-800.woff2",
    "/fonts/bricolage-800.woff",
    "/icons/icon-192.png",
    "/icons/maskable-512.png",
    "/worklets/pcm.js",
  ])("%s is precached", (path) => {
    expect(policy(path)).toBe("precache");
  });

  it.each([
    // Dev chunks keep their name across edits, so caching them would serve stale code.
    "/_next/static/chunks/src_app_layout_tsx_1igg3k2._.js",
    "/_next/static/chunks/[turbopack]_browser_dev_hmr-client_hmr-client_ts_1di75ot._.js",
    "/_next/static/development/_buildManifest.js",
    "/_next/static/E8KpbyXGFUNogHihW_8uj/_buildManifest.js",
    "/_next/static/chunks/app/page.js",
    "/_next/image?url=%2Fx.png&w=64&q=75",
    "/_next/webpack-hmr",
    "/sw.js",
    "/manifest.webmanifest",
    "/favicon.ico",
  ])("%s is never stored", (path) => {
    expect(policy(path)).not.toBe("precache");
  });

  it.each(["/", "/sign-in", "/home", "/start", "/account", "/offline/x", "/offline-ish", "/apple", "/careers", "/items", "/apiary"])(
    "%s is a navigation with the offline fallback",
    (path) => {
      expect(policy(path)).toBe("navigate_with_offline_fallback");
    },
  );

  it("never touches another origin", () => {
    expect(cachePolicy(new URL("https://fonts.gstatic.com/s/x.woff2"), ORIGIN)).toBe("network_only");
    expect(cachePolicy(new URL("https://cdn.example/icons/icon-192.png"), ORIGIN)).toBe("network_only");
    expect(cachePolicy(new URL("http://ferry.example/offline"), ORIGIN)).toBe("network_only");
  });

  it("accepts a string URL", () => {
    expect(cachePolicy(`${ORIGIN}/offline`, ORIGIN)).toBe("precache");
  });
});
