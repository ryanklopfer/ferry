import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

const matcher = new RegExp(`^${config.matcher[0]}$`);
const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

describe("proxy matcher", () => {
  it.each(["/", "/plans", "/claims/1/edit", "/account", "/api/claims/1/packet", "/api/v1/claims"])("guards %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each(["/sign-in", "/api/auth/magic-link/verify", "/_next/static/chunks/app.js", "/_next/image", "/_next/hmr", "/_next/webpack-hmr", "/favicon.ico"])(
    "leaves %s alone",
    (path) => {
      expect(matcher.test(path)).toBe(false);
    },
  );
});

describe("proxy", () => {
  it("sends a page request with no session cookie to sign-in", () => {
    const response = proxy(request("/plans"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in");
  });

  it("answers an API request with no session cookie with 401", () => {
    expect(proxy(request("/api/claims/1/packet")).status).toBe(401);
  });

  it("lets a request with a session cookie through to the real check", () => {
    const response = proxy(request("/plans", "better-auth.session_token=anything"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
