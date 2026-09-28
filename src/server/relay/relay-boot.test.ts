import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { CLOSE, encodeFrame } from "@/core/capture/protocol";
import { FRAME_BYTES } from "@/core/capture/pcm";
import { modeEnvVar, VENDORS } from "@/server/integrations/mode";
import { issueRelayToken } from "./token";

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

  it("refuses to start in the prelaunch tier, which serves public pages only", () => {
    const off = Object.fromEntries(VENDORS.map((v) => [modeEnvVar(v), "off"]));
    // Past the shared boot checks (the placeholder contact address), so the refusal is the relay's own.
    const r = run({ ...off, NODE_ENV: "production", FERRY_DEPLOY_TIER: "prelaunch", FERRY_ALLOW_PLACEHOLDER_CONTACT: "1" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('"reason":"The relay does not run in the prelaunch tier (public pages only)"');
    expect(r.stdout).not.toContain("relay.listening");
  });

  it("boots and listens under bun in the dev tier, counts a frame and enforces the 4 KiB message limit", async () => {
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
      const { port } = JSON.parse(line);
      expect(port).toBeGreaterThan(0);

      // Bun's ws ignores maxPayload; the relay must still refuse an oversize message itself.
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/capture/cap_bun?token=${encodeURIComponent(issueRelayToken({ captureId: "cap_bun", subject: "devRun:boot" }, SECRET, Date.now()))}`);
      const messages: { type: string; audioMs?: number }[] = [];
      ws.on("message", (d) => messages.push(JSON.parse(d.toString())));
      const closed = new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));
      await new Promise((resolve, reject) => {
        ws.on("open", resolve);
        ws.on("error", reject);
      });
      ws.send(encodeFrame({ captureId: "cap_bun", seq: 0, msOffset: 0 }, new Uint8Array(FRAME_BYTES)));
      const end = Date.now() + 5_000;
      while (!messages.some((m) => m.type === "ack") && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
      expect(messages.find((m) => m.type === "ack")).toEqual({ type: "ack", seq: 0, audioMs: 100 });
      ws.send(new Uint8Array(10_000));
      expect(await closed).toBe(CLOSE.tooBig);
    } finally {
      child.kill("SIGTERM");
    }
  });
});
