import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { modeEnvVar, VENDORS } from "@/server/integrations/mode";

const MAIN = path.join(__dirname, "main.ts");
const SECRET = "b".repeat(32);

// Explicit values win over anything bun loads from .env files.
function baseEnv(extra: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", FERRY_DATA_CLASS: "synthetic", DATABASE_URL: "postgres://localhost:5432/ferry_test", RELAY_SECRET: SECRET, RELAY_PORT: "0", ...extra };
  delete env.VITEST;
  for (const [k, v] of Object.entries(extra)) if (v === undefined) delete env[k];
  return env;
}

const run = (extra: Record<string, string | undefined>) => spawnSync("bun", [MAIN], { env: baseEnv(extra), encoding: "utf8", timeout: 20_000 });

describe("relay entrypoint", () => {
  it("exits non-zero in the prod tier with a fixture vendor, naming the vendor", () => {
    const live = Object.fromEntries(VENDORS.map((v) => [modeEnvVar(v), "live"]));
    const r = run({ ...live, NODE_ENV: "production", FERRY_DEPLOY_TIER: "prod", [modeEnvVar("scribe")]: "fixture" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('"reason":"scribe: mode fixture is not allowed in the prod tier"');
    expect(r.stdout).not.toContain("relay.listening");
  });

  it("exits non-zero without a RELAY_SECRET, naming it", () => {
    const r = run({ FERRY_DEPLOY_TIER: "dev", RELAY_SECRET: undefined });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("RELAY_SECRET");
    expect(r.stdout).not.toContain("relay.listening");
  });

  it("boots and listens under bun in the dev tier", async () => {
    const child = spawn("bun", [MAIN], { env: baseEnv({ FERRY_DEPLOY_TIER: "dev" }) });
    try {
      const line = await new Promise<string>((resolve, reject) => {
        let out = "";
        const timer = setTimeout(() => reject(new Error(`no listening line: ${out}`)), 15_000);
        child.stdout.on("data", (d) => {
          out += d;
          const hit = out.split("\n").find((l) => l.includes("relay.listening"));
          if (hit) {
            clearTimeout(timer);
            resolve(hit);
          }
        });
        child.on("exit", (code) => reject(new Error(`exited ${code}`)));
      });
      expect(JSON.parse(line).port).toBeGreaterThan(0);
    } finally {
      child.kill("SIGTERM");
    }
  });
});
