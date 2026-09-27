import { randomBytes } from "node:crypto";
import { isValidElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "@/proxy";
import { devRunId } from "@/server/dev-spike";
import { verifyRelayToken } from "@/server/relay/token";
import { GET, POST } from "../api/dev/relay-token/route";
import FileInputPage from "./file-input/page";
import MicPage from "./mic/page";

const K = randomBytes(32).toString("base64url");
const SECRET = "s".repeat(32);
const matcher = new RegExp(`^${config.matcher[0]}$`);

type Page = (props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<ReactElement>;

// A page either renders (Next answers 200) or calls notFound() (Next answers 404).
async function pageStatus(page: Page, query: Record<string, string>): Promise<{ status: 200 | 404; html?: string }> {
  try {
    const element = await page({ searchParams: Promise.resolve(query) });
    expect(isValidElement(element)).toBe(true);
    return { status: 200, html: renderToString(element) };
  } catch (e) {
    if ((e as { digest?: string }).digest === "NEXT_HTTP_ERROR_FALLBACK;404") return { status: 404 };
    throw e;
  }
}

const tokenRequest = (body: unknown) => new Request("http://localhost:3000/api/dev/relay-token", { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

function setEnv(tier: string, k: string | undefined) {
  vi.stubEnv("FERRY_DEPLOY_TIER", tier);
  vi.stubEnv("FERRY_SPIKE_K", k);
  vi.stubEnv("RELAY_SECRET", SECRET);
}

beforeEach(() => setEnv("dev", K));
afterEach(() => vi.unstubAllEnvs());

describe("dev pages, signed out", () => {
  it.each(["/dev/mic", "/dev/file-input", "/api/dev/relay-token", "/api/dev/manifest"])("the proxy lets %s through without a session; the route enforces tier and k", (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it("with a valid k, /dev/mic returns 200 in the dev tier", async () => {
    const r = await pageStatus(MicPage, { k: K });
    expect(r.status).toBe(200);
    expect(r.html).toContain("Start recording");
  });

  it("with a valid k, /dev/file-input returns 200 in the dev tier", async () => {
    const r = await pageStatus(FileInputPage, { k: K });
    expect(r.status).toBe(200);
    expect(r.html).toMatch(/<input[^>]*type="file"/);
    expect(r.html).toContain('accept="image/*"');
    expect(r.html).not.toMatch(/capture=/);
  });

  it("with a valid k, POST /api/dev/relay-token issues a token bound to the capture and this dev run", async () => {
    const res = await POST(tokenRequest({ k: K, captureId: "cap_spike1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { token, url } = await res.json();
    expect(url).toBe("/ws/capture/cap_spike1");
    const verified = verifyRelayToken(token, SECRET, Date.now());
    expect(verified.ok && verified.claims).toMatchObject({ captureId: "cap_spike1", subject: `devRun:${devRunId(K)}` });
  });

  it("points the browser at FERRY_RELAY_URL when it is set", async () => {
    vi.stubEnv("FERRY_RELAY_URL", "ws://localhost:3101");
    const { url } = await (await POST(tokenRequest({ k: K, captureId: "cap_spike2" }))).json();
    expect(url).toBe("ws://localhost:3101/ws/capture/cap_spike2");
  });

  it("refuses a malformed capture id with a valid k", async () => {
    expect((await POST(tokenRequest({ k: K, captureId: "../etc" }))).status).toBe(400);
  });
});

describe("dev pages without k, or outside the dev tier, are 404", () => {
  const cases: [string, () => void, Record<string, string>][] = [
    ["no k", () => {}, {}],
    ["a wrong k", () => {}, { k: randomBytes(32).toString("base64url") }],
    ["an empty k", () => {}, { k: "" }],
    ["no FERRY_SPIKE_K on the server", () => setEnv("dev", undefined), { k: K }],
    ["a FERRY_SPIKE_K under 32 characters", () => setEnv("dev", "short"), { k: "short" }],
    ["the prelaunch tier", () => setEnv("prelaunch", K), { k: K }],
    ["the staging tier", () => setEnv("staging", K), { k: K }],
    ["the prod tier", () => setEnv("prod", K), { k: K }],
  ];

  it.each(cases)("with %s", async (_label, arrange, query) => {
    arrange();
    expect((await pageStatus(MicPage, query)).status).toBe(404);
    expect((await pageStatus(FileInputPage, query)).status).toBe(404);
    expect((await POST(tokenRequest({ ...query, captureId: "cap_spike3" }))).status).toBe(404);
  });

  it("any other method on /api/dev/relay-token is 404, never 405, with or without k", () => {
    expect(GET().status).toBe(404);
    setEnv("prod", K);
    expect(GET().status).toBe(404);
  });

  it("POST /api/dev/relay-token with no body or a non-JSON body is 404", async () => {
    expect((await POST(tokenRequest(undefined))).status).toBe(404);
    expect((await POST(new Request("http://localhost:3000/api/dev/relay-token", { method: "POST", body: "k=x" }))).status).toBe(404);
  });

  it("does not take k from the query string of the token route", async () => {
    const res = await POST(new Request(`http://localhost:3000/api/dev/relay-token?k=${K}`, { method: "POST", body: JSON.stringify({ captureId: "cap_spike4" }) }));
    expect(res.status).toBe(404);
  });
});
