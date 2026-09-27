import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertDevPhone, caddyfile, missingTools, qr, SPIKE_PATHS, spikeUrl, tunnelUrlIn } from "./phone-setup";

const DEV = { FERRY_DEPLOY_TIER: "dev", DATABASE_URL: "postgres://localhost:5432/ferry_dev" };
const MAIN = path.join(__dirname, "phone.ts");

// Explicit values win over anything bun loads from .env files.
function run(extra: Record<string, string>) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development", DATABASE_URL: "postgres://localhost:5432/ferry_test", ...extra };
  delete env.VITEST;
  return spawnSync("bun", [MAIN], { env, encoding: "utf8", timeout: 20_000 });
}

describe("dev:phone refuses", () => {
  it.each([
    ["unset (counts as real)", {}],
    ["real", { FERRY_DATA_CLASS: "real" }],
    ["deidentified", { FERRY_DATA_CLASS: "deidentified" }],
  ])("without FERRY_DATA_CLASS=synthetic: %s", (_label, extra) => {
    expect(() => assertDevPhone({ ...DEV, ...extra })).toThrow(/FERRY_DATA_CLASS=synthetic/);
  });

  it.each(["prelaunch", "staging", "prod"])("outside the dev tier: %s", (tier) => {
    expect(() => assertDevPhone({ ...DEV, FERRY_DATA_CLASS: "synthetic", FERRY_DEPLOY_TIER: tier })).toThrow(/dev tier/);
  });

  it("against a database that isn't a _dev or _test one", () => {
    expect(() => assertDevPhone({ ...DEV, FERRY_DATA_CLASS: "synthetic", DATABASE_URL: "postgres://db.example.test/ferry" })).toThrow(/_dev or _test/);
  });

  it.each(["live", "test"])("with any vendor in %s mode, naming the variable", (mode) => {
    expect(() => assertDevPhone({ ...DEV, FERRY_DATA_CLASS: "synthetic", FERRY_EMAIL_MODE: mode })).toThrow(/FERRY_EMAIL_MODE/);
    expect(() => assertDevPhone({ ...DEV, FERRY_DATA_CLASS: "synthetic", FERRY_EPHEMERAL_KEYS_MODE: mode })).toThrow(/FERRY_EPHEMERAL_KEYS_MODE/);
  });

  it("allows the dev tier with synthetic data and every vendor on fixture, local or off", () => {
    expect(() => assertDevPhone({ ...DEV, FERRY_DATA_CLASS: "synthetic" })).not.toThrow();
    expect(() => assertDevPhone({ ...DEV, FERRY_DATA_CLASS: "synthetic", FERRY_KEYS_MODE: "local", FERRY_STORAGE_MODE: "local", FERRY_SMS_MODE: "off" })).not.toThrow();
  });

  it("exits non-zero before starting anything when a vendor is live", () => {
    const r = run({ FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "synthetic", DATABASE_URL: "postgres://localhost:5432/ferry_dev", FERRY_EMAIL_MODE: "live" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("FERRY_EMAIL_MODE");
    expect(r.stdout).not.toContain("build:sw");
  });

  it("exits non-zero before starting anything when the data class is not synthetic", () => {
    const r = run({ FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "real" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("FERRY_DATA_CLASS=synthetic");
    expect(r.stdout).not.toContain("build:sw");
    expect(r.stdout).not.toContain("trycloudflare");
  });

  it("exits non-zero before starting anything outside the dev tier", () => {
    const r = run({ FERRY_DEPLOY_TIER: "staging", FERRY_DATA_CLASS: "synthetic" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("only in the dev tier");
    expect(r.stdout).not.toContain("build:sw");
  });
});

describe("dev:phone setup", () => {
  it("names caddy and cloudflared when they are missing", () => {
    expect(missingTools(() => false)).toEqual(["caddy", "cloudflared"]);
    expect(missingTools((bin) => bin === "caddy")).toEqual(["cloudflared"]);
    expect(missingTools(() => true)).toEqual([]);
  });

  it("routes /ws/* to the relay, only the spike's paths to next dev and 404s the rest, on loopback only", () => {
    const c = caddyfile({ caddy: 3080, next: 3000, relay: 3001 });
    expect(c).toContain("http://:3080");
    expect(c).toContain("bind 127.0.0.1");
    expect(c).toMatch(/handle \/ws\/\* \{\s+reverse_proxy 127\.0\.0\.1:3001/);
    expect(c).toContain(`@spike path ${SPIKE_PATHS.join(" ")}`);
    expect(c).toMatch(/handle @spike \{\s+reverse_proxy 127\.0\.0\.1:3000/);
    expect(c).toMatch(/handle \{\s+respond 404\s+\}/);
    expect(c.match(/reverse_proxy 127\.0\.0\.1:3000/g)).toHaveLength(1);
    expect(c).toContain("admin off");
  });

  it("keeps sign-in, the API and the app off the tunnel", () => {
    for (const p of SPIKE_PATHS) expect(p).not.toMatch(/^\/(api\/(auth|v1)|sign-in|app|c|i|home|account)\b/);
    expect(SPIKE_PATHS).not.toContain("/api/*");
    expect(SPIKE_PATHS).not.toContain("/*");
  });

  it("finds the quick tunnel's URL in cloudflared's output", () => {
    const out = "2026-09-29T19:00:00Z INF |  https://brave-otter-lake-sun.trycloudflare.com                                |";
    expect(tunnelUrlIn(out)).toBe("https://brave-otter-lake-sun.trycloudflare.com");
    expect(tunnelUrlIn("INF Requesting new quick Tunnel on trycloudflare.com...")).toBeNull();
  });

  it("prints a square QR code of the spike URL with a quiet zone", () => {
    const url = spikeUrl("https://brave-otter-lake-sun.trycloudflare.com", "k".repeat(43));
    expect(url).toBe(`https://brave-otter-lake-sun.trycloudflare.com/dev/mic?k=${"k".repeat(43)}`);
    const lines = qr(url)
      .split("\n")
      .map((l) => l.replace(/\x1b\[[0-9;]*m/g, ""));
    const width = lines[0].length;
    expect(lines.every((l) => l.length === width)).toBe(true);
    expect(lines.length).toBe(Math.ceil(width / 2));
    expect(lines[0]).toBe(" ".repeat(width));
    // Rows 0 and 1 of the top-left finder pattern, just inside the quiet zone.
    expect(lines[2].slice(4, 11)).toBe("█▀▀▀▀▀█");
  });
});

describe("next.config.ts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("admits *.trycloudflare.com as a dev origin only while dev:phone runs", async () => {
    vi.resetModules();
    vi.stubEnv("FERRY_DEV_PHONE", undefined);
    expect((await import("../../next.config")).default.allowedDevOrigins).toEqual([]);
    vi.resetModules();
    vi.stubEnv("FERRY_DEV_PHONE", "1");
    expect((await import("../../next.config")).default.allowedDevOrigins).toEqual(["*.trycloudflare.com"]);
  });

  it("is what phone.ts sets for its children", () => {
    expect(fs.readFileSync(MAIN, "utf8")).toMatch(/FERRY_DEV_PHONE: "1"/);
  });
});
