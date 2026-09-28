// bun run lighthouse:home — builds, starts the homepage the way the preview host runs it (prelaunch tier, every
// vendor off), runs Lighthouse's default mobile audit and exits non-zero below 90 for performance or accessibility.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { modeEnvVar, VENDORS } from "../../src/server/integrations/mode";

const PORT = 3192;
const URL = `http://localhost:${PORT}/`;
const MIN = 0.9;

const hostEnv: NodeJS.ProcessEnv = { NODE_ENV: "production", PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR };

const build = spawnSync("bun", ["run", "build"], { stdio: "inherit", env: hostEnv });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn("bun", ["run", "start"], {
  detached: true,
  stdio: "ignore",
  env: { ...hostEnv, PORT: String(PORT), FERRY_DEPLOY_TIER: "prelaunch", ...Object.fromEntries(VENDORS.map((v) => [modeEnvVar(v), "off"])) },
});
const stop = () => server.pid && server.exitCode === null && process.kill(-server.pid, "SIGTERM");

async function ready() {
  for (const deadline = Date.now() + 60_000; Date.now() < deadline; await new Promise((r) => setTimeout(r, 250))) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {}
  }
  throw new Error(`${URL} never answered`);
}

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ferry-lighthouse-")), "home.json");
let failed = true;
try {
  await ready();
  const lh = spawnSync(
    "bunx",
    ["lighthouse", URL, "--output=json", `--output-path=${out}`, "--only-categories=performance,accessibility", "--chrome-flags=--headless=new", "--quiet"],
    { stdio: "inherit", env: { ...process.env, CHROME_PATH: process.env.CHROME_PATH ?? chromium.executablePath() } },
  );
  if (lh.status !== 0) throw new Error(`lighthouse exited with ${lh.status}`);
  const { categories } = JSON.parse(fs.readFileSync(out, "utf8")) as { categories: Record<string, { score: number | null }> };
  const scores = { performance: categories.performance.score ?? 0, accessibility: categories.accessibility.score ?? 0 };
  for (const [name, score] of Object.entries(scores)) console.log(`${name}: ${Math.round(score * 100)}${score < MIN ? ` (below ${MIN * 100})` : ""}`);
  failed = Object.values(scores).some((s) => s < MIN);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
} finally {
  stop();
}
process.exit(failed ? 1 : 0);
