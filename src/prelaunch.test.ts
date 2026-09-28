import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOIN_BETA } from "@/core/copy/home";
import { isPrelaunch } from "@/server/deploy";
import { modeEnvVar, VENDORS } from "@/server/integrations/mode";

describe("isPrelaunch", () => {
  it("the prelaunch tier implies FERRY_PRELAUNCH=1", () => {
    expect(isPrelaunch({ FERRY_DEPLOY_TIER: "prelaunch" })).toBe(true);
    expect(isPrelaunch({ FERRY_DEPLOY_TIER: "prod", FERRY_PRELAUNCH: "1" })).toBe(true);
    expect(isPrelaunch({ FERRY_DEPLOY_TIER: "dev", FERRY_PRELAUNCH: "1" })).toBe(true);
    for (const tier of ["dev", "staging", "prod"]) expect(isPrelaunch({ FERRY_DEPLOY_TIER: tier }), tier).toBe(false);
    expect(isPrelaunch({})).toBe(false);
  });

  it("fails closed on a tier it can't read", () => {
    expect(isPrelaunch({ FERRY_DEPLOY_TIER: "devx" })).toBe(true);
    expect(isPrelaunch({ NODE_ENV: "production" })).toBe(true);
  });
});

// The real thing: a production build, started the way a preview host runs it. No database is reachable and
// every vendor is off, so anything but the public pages would fail rather than quietly work.
const PORT = 3190;
const BASE = `http://localhost:${PORT}`;
const ROOT = process.cwd();

// Not vitest's own environment (NODE_ENV=test, VITEST): only what a host shell would have, plus the tier's settings.
const serverEnv = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({ NODE_ENV: "production", PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, ...extra });

const PRELAUNCH_ENV = {
  FERRY_DEPLOY_TIER: "prelaunch",
  PORT: String(PORT),
  DATABASE_URL: "postgres://127.0.0.1:9/ferry_prelaunch_has_no_database",
  ...Object.fromEntries(VENDORS.map((v) => [modeEnvVar(v), "off"])),
};

async function waitForServer(child: ChildProcess, log: () => string) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited with ${child.exitCode}:\n${log()}`);
    try {
      await fetch(`${BASE}/for-clients`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`next start never answered:\n${log()}`);
}

describe("bun run build && FERRY_DEPLOY_TIER=prelaunch bun run start", () => {
  let server: ChildProcess;
  let output = "";

  beforeAll(async () => {
    const build = spawnSync("bun", ["run", "build"], { cwd: ROOT, env: serverEnv(), encoding: "utf8", timeout: 300_000 });
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    server = spawn("bun", ["run", "start"], { cwd: ROOT, env: serverEnv(PRELAUNCH_ENV), detached: true });
    server.stdout?.on("data", (d) => (output += d));
    server.stderr?.on("data", (d) => (output += d));
    await waitForServer(server, () => output);
  }, 360_000);

  afterAll(() => {
    if (server?.pid && server.exitCode === null) process.kill(-server.pid, "SIGTERM");
  });

  it("boots in the prelaunch tier with every vendor off", () => {
    expect(output).toMatch(/"event":"boot\.ok","kind":"next","tier":"prelaunch"/);
  });

  it("serves / with 200, and the other public pages", async () => {
    for (const path of ["/", "/for-clients", "/legal/terms", "/legal/privacy", "/offline", "/manifest.webmanifest", "/sw.js"]) {
      expect((await fetch(`${BASE}${path}`, { redirect: "manual" })).status, path).toBe(200);
    }
  });

  it("/app, /c, /api/v1, /sign-in and every other path return 404", async () => {
    for (const path of ["/app", "/c", "/api/v1/claims", "/api/v1", "/sign-in", "/start", "/home", "/account", "/ops", "/i/tok", "/api/auth/get-session", "/dev/ui", "/legal/nothing-here"]) {
      expect((await fetch(`${BASE}${path}`, { redirect: "manual" })).status, path).toBe(404);
    }
  });

  it("Start free is a mailto: every trial button reads Join the beta and opens the beta email", async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    expect(html).not.toMatch(/>Start free|>Log in</);
    expect(html).not.toMatch(/href="\/(start|sign-in)"/);
    const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>(?:(?!<\/a>)[\s\S])*?Join the beta/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(hrefs).toHaveLength(5);
    expect(new Set(hrefs)).toEqual(new Set([JOIN_BETA.href]));
  });

  it("loads no script or stylesheet from another origin", async () => {
    for (const path of ["/", "/for-clients", "/legal/terms"]) {
      const html = await (await fetch(`${BASE}${path}`)).text();
      const external = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
      expect(external, path).toEqual([]);
    }
  });
});
