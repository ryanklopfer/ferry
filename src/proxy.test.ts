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
