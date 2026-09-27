import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DeployConfigError } from "@/server/deploy";
import { assertDevPhone, caddyfile, missingTools, PORTS, qr, spikeUrl, tunnelUrlIn } from "./phone-setup";

// `bun run dev:phone`: next dev and the relay behind Caddy on one origin, exposed through a cloudflared quick
// tunnel so a phone gets a trusted certificate (the mic needs a secure context). Prints a QR code of
// /dev/mic with this run's key. Synthetic speech only.
try {
  assertDevPhone();
} catch (e) {
  console.error(e instanceof DeployConfigError ? e.message : "dev:phone refused to start");
  process.exit(1);
}
const missing = missingTools();
if (missing.length) {
  console.error(`dev:phone needs ${missing.join(" and ")} on PATH. Install with: brew install caddy cloudflared`);
  process.exit(1);
}

const k = randomBytes(32).toString("base64url");
const env: NodeJS.ProcessEnv = {
  ...process.env,
  FERRY_DEPLOY_TIER: "dev",
  FERRY_DATA_CLASS: "synthetic",
  FERRY_SPIKE_K: k,
  RELAY_SECRET: randomBytes(32).toString("base64url"),
  RELAY_PORT: String(PORTS.relay),
};
delete env.FERRY_RELAY_URL;

const build = spawnSync("bun", ["run", "build:sw"], { env, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ferry-dev-phone-"));
const config = path.join(tmp, "Caddyfile");
fs.writeFileSync(config, caddyfile());

const children: ChildProcess[] = [];
let stopping = false;
function stopAll(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(code);
}
function start(name: string, cmd: string, args: string[], stdio: "inherit" | "pipe" = "inherit") {
  const child = spawn(cmd, args, { env, stdio: stdio === "pipe" ? ["ignore", "pipe", "pipe"] : "inherit" });
  child.on("exit", (code) => {
    if (!stopping) console.error(`dev:phone: ${name} exited (${code}); stopping everything`);
    stopAll(code || 1);
  });
  children.push(child);
  return child;
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => stopAll(0));

start("relay", "bun", ["src/server/relay/main.ts"]);
start("next", "bunx", ["next", "dev", "--port", String(PORTS.next)]);
start("caddy", "caddy", ["run", "--config", config, "--adapter", "caddyfile"]);
const tunnel = start("cloudflared", "cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${PORTS.caddy}`], "pipe");

let printed = false;
const watch = (chunk: Buffer) => {
  const origin = printed ? null : tunnelUrlIn(chunk.toString());
  if (!origin) return;
  printed = true;
  const url = spikeUrl(origin, k);
  console.log(`\n${qr(url)}\n\nScan with the phone's camera, or open:\n${url}\n\nAndroid file-input check: ${origin}/dev/file-input?k=${encodeURIComponent(k)}\nWhen you add it to the Home Screen, the installed app opens on the mic spike.\nSynthetic speech only (corpus/synthetic/audio). Ctrl-C stops everything.\n`);
};
tunnel.stdout?.on("data", watch);
tunnel.stderr?.on("data", watch);
