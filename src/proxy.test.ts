import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";
import { config, DEV_PUBLIC_PATHS, PRELAUNCH_PATHS, PUBLIC_PATHS, proxy } from "./proxy";

const matcher = new RegExp(`^${config.matcher[0]}$`);
const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);
const passes = (path: string) => !matcher.test(path) || proxy(request(path)).headers.get("x-middleware-next") === "1";
// "/i/*" stands for anything under /i/, so a sample path is the prefix plus one more segment.
const sample = (entry: string) => (entry.endsWith("/*") ? `${entry.slice(0, -1)}x` : entry);

afterEach(() => vi.unstubAllEnvs());

describe("proxy matcher", () => {
  it.each(["/_next/static/chunks/app.js", "/_next/image", "/_next/hmr", "/_next/webpack-hmr", "/favicon.ico"])("leaves framework asset %s alone", (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it.each(["/", "/start", "/app", "/app/claims", "/c", "/ops", "/account", "/home", "/sign-in", "/api/v1/claims", "/dev/mic", "/i/tok"])("sees %s, so the allow-list in code decides", (path) => {
    expect(matcher.test(path)).toBe(true);
  });
});

describe("signed out", () => {
  it.each(PUBLIC_PATHS.map((p) => [p, sample(p)]))("PUBLIC_PATHS entry %s (%s) is not redirected", (_entry, path) => {
    vi.stubEnv("FERRY_DEPLOY_TIER", "prod");
    expect(passes(path)).toBe(true);
  });

  it.each(["/manifest.webmanifest", "/sw.js", "/offline", "/icons/icon-192.png", "/icons/maskable-512.png", "/worklets/pcm.js", "/legal/terms", "/i/tok_synthetic", "/api/webhooks/stripe", "/api/auth/magic-link/verify"])(
    "app shell and public file %s passes",
    (path) => {
      expect(passes(path)).toBe(true);
    },
  );

  it("/app/claims redirects to /sign-in", () => {
    const response = proxy(request("/app/claims"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in");
  });

  it("/api/v1/claims answers 401 in the API error shape", async () => {
    const response = proxy(request("/api/v1/claims"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized", message: "Sign in first." });
  });

  it.each(["/app", "/c", "/c/trips", "/ops", "/account", "/home", "/plans", "/i", "/legal", "/iconsx", "/offline-notes", "/sw.jsx", "/manifest.webmanifest.bak", "/startx", "/start/x", "/for-clients/x", "/sign-in/x", "/app/icons/x.png"])(
    "%s, which no entry covers, redirects",
    (path) => {
      expect(proxy(request(path)).status).toBe(307);
    },
  );

  it.each(["/api/v1/claims/clm_1", "/api/webhooks", "/api/webhooksx", "/api/devx", "/api/v1/dev/x"])("%s answers 401", (path) => {
    expect(proxy(request(path)).status).toBe(401);
  });
});

describe("dev-only public paths", () => {
  it.each(DEV_PUBLIC_PATHS.map((p) => [p, sample(p)]))("%s (%s) passes signed out in the dev tier", (_entry, path) => {
    vi.stubEnv("FERRY_DEPLOY_TIER", "dev");
    expect(passes(path)).toBe(true);
  });

  it("/dev/mic passes the proxy only in the dev tier", () => {
    vi.stubEnv("FERRY_DEPLOY_TIER", "dev");
    expect(proxy(request("/dev/mic")).headers.get("x-middleware-next")).toBe("1");
    for (const tier of ["staging", "prod"]) {
      vi.stubEnv("FERRY_DEPLOY_TIER", tier);
      const response = proxy(request("/dev/mic"));
      expect(response.status, tier).toBe(307);
      expect(response.headers.get("location"), tier).toBe("http://localhost:3000/sign-in");
      expect(proxy(request("/api/dev/relay-token")).status, tier).toBe(401);
    }
    vi.stubEnv("FERRY_DEPLOY_TIER", "prelaunch");
    expect(proxy(request("/dev/mic")).status).toBe(404);
    expect(proxy(request("/api/dev/relay-token")).status).toBe(404);
  });

  it("an unreadable tier is not the dev tier, and serves only the prelaunch pages", () => {
    vi.stubEnv("FERRY_DEPLOY_TIER", "devx");
    expect(proxy(request("/dev/mic")).status).toBe(404);
    expect(proxy(request("/")).headers.get("x-middleware-next")).toBe("1");
  });
});

describe("prelaunch", () => {
  const passesIn = (path: string, cookie?: string) => !matcher.test(path) || proxy(request(path, cookie)).headers.get("x-middleware-next") === "1";

  it("serves only the marketing pages and the app shell's files", () => {
    vi.stubEnv("FERRY_DEPLOY_TIER", "prelaunch");
    for (const entry of PRELAUNCH_PATHS) expect(passesIn(sample(entry)), entry).toBe(true);
    for (const path of ["/legal/terms", "/icons/icon-192.png", "/_next/static/chunks/app.js"]) expect(passesIn(path), path).toBe(true);
  });

  it.each(["/app", "/app/clients", "/c", "/api/v1/claims", "/sign-in", "/start", "/home", "/account", "/ops", "/i/tok", "/api/auth/magic-link/verify", "/api/webhooks/stripe", "/worklets/pcm.js", "/dev/ui"])(
    "%s is a 404, signed in or not",
    async (path) => {
      vi.stubEnv("FERRY_DEPLOY_TIER", "prelaunch");
      for (const cookie of [undefined, "better-auth.session_token=anything"]) {
        const response = proxy(request(path, cookie));
        expect(response.status, cookie ?? "signed out").toBe(404);
        expect(await response.text()).toBe("Not found");
      }
    },
  );

  it("FERRY_PRELAUNCH=1 turns it on in any tier", () => {
    vi.stubEnv("FERRY_DEPLOY_TIER", "prod");
    expect(proxy(request("/sign-in")).headers.get("x-middleware-next")).toBe("1");
    vi.stubEnv("FERRY_PRELAUNCH", "1");
    expect(proxy(request("/sign-in")).status).toBe(404);
    expect(proxy(request("/for-clients")).headers.get("x-middleware-next")).toBe("1");
  });

  it("every prelaunch path is also public", () => {
    expect(PRELAUNCH_PATHS.filter((p) => !(PUBLIC_PATHS as readonly string[]).includes(p))).toEqual([]);
  });
});

describe("signed in", () => {
  it("lets a request with a session cookie through to the real check", () => {
    const response = proxy(request("/app/claims", "better-auth.session_token=anything"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("next.config headers", () => {
  it.each(["/app", "/c", "/i", "/ops", "/dev", "/api"])("%s and everything under it is sent with Cache-Control: no-store", async (prefix) => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.find((r) => r.source === `${prefix}/:path*`)?.headers).toEqual([{ key: "Cache-Control", value: "no-store" }]);
  });
});
