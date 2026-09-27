import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { config, proxy } from "./proxy";

const matcher = new RegExp(`^${config.matcher[0]}$`);
const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

describe("proxy matcher", () => {
  it.each(["/", "/plans", "/claims/1/edit", "/account", "/api/claims/1/packet", "/api/v1/claims", "/home", "/offline-notes", "/offline/x", "/sw.jsx", "/swajs", "/manifest.webmanifest.bak", "/app/icons/x.png", "/iconsx", "/dev", "/devices", "/app/dev/mic", "/api/devx", "/api/v1/dev/x"])("guards %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each(["/sign-in", "/api/auth/magic-link/verify", "/_next/static/chunks/app.js", "/_next/image", "/_next/hmr", "/_next/webpack-hmr", "/favicon.ico", "/dev/mic", "/dev/file-input", "/api/dev/relay-token"])(
    "leaves %s alone",
    (path) => {
      expect(matcher.test(path)).toBe(false);
    },
  );
});

// Signed out, the proxy never sees these, so Next serves them with a 200 (e2e/pwa.spec.ts fetches each one).
describe("app shell files, signed out", () => {
  it.each(["/manifest.webmanifest", "/sw.js", "/offline", "/icons/icon-192.png", "/icons/maskable-512.png", "/worklets/pcm.js"])("%s is not redirected to sign-in", (path) => {
    expect(matcher.test(path)).toBe(false);
  });
});

describe("proxy", () => {
  it("sends a page request with no session cookie to sign-in", () => {
    const response = proxy(request("/plans"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in");
  });

  it("answers an API request with no session cookie with a 401 in the API error shape", async () => {
    const response = proxy(request("/api/v1/claims"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized", message: "Sign in first." });
  });

  it("lets a request with a session cookie through to the real check", () => {
    const response = proxy(request("/plans", "better-auth.session_token=anything"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("next.config headers", () => {
  it.each(["/app", "/c", "/i", "/ops", "/dev", "/api"])("%s and everything under it is sent with Cache-Control: no-store", async (prefix) => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.find((r) => r.source === `${prefix}/:path*`)?.headers).toEqual([{ key: "Cache-Control", value: "no-store" }]);
  });
});
