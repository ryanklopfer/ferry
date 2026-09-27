import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { modeEnvVar, VENDORS } from "./integrations/mode";

const FIXTURE = path.join(__dirname, "__fixtures__", "crash.ts");
const MARKER = "Samira-Haddad-U4827193";

// Explicit values win over anything bun loads from .env files.
function run(how: string, extra: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "synthetic", DATABASE_URL: "postgres://localhost:5432/ferry_test", ...extra };
  delete env.VITEST;
  for (const [k, v] of Object.entries(extra)) if (v === undefined) delete env[k];
  const r = spawnSync("bun", [FIXTURE, how, MARKER], { env, encoding: "utf8", timeout: 20_000 });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}`, stdout: r.stdout, stderr: r.stderr };
}

describe("process error handlers installed by bootProcess", () => {
  it("exits non-zero on an unhandled rejection and prints only the error name", () => {
    const r = run("reject");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('"error":"TypeError"');
    expect(r.out).not.toContain(MARKER);
  });

  it("exits non-zero on an uncaught exception and prints only the error name", () => {
    const r = run("throw");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('"error":"RangeError"');
    expect(r.out).not.toContain(MARKER);
  });

  it("keeps the Next process running on an unhandled rejection, logging only the error name", () => {
    const r = run("reject", { CRASH_KIND: "next" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("still-running");
    expect(r.stderr).toContain('"error":"TypeError"');
    expect(r.out).not.toContain(MARKER);
  });

  it("ignores React postpone signals", () => {
    const r = run("postpone");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("still-running");
    expect(r.stderr).not.toContain("process.unhandled_rejection");
  });

  it("scrubs console.error and console.warn to error names when FERRY_SCRUB_ERRORS=1", () => {
    const r = run("console", { FERRY_SCRUB_ERRORS: "1" });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('"error":"SyntaxError"');
    expect(r.out).not.toContain(MARKER);
  });

  it("scrubs the console in any tier but dev, even with NODE_ENV unset", () => {
    const modes = Object.fromEntries(VENDORS.map((v) => [modeEnvVar(v), "test"]));
    const r = run("console", { ...modes, FERRY_DEPLOY_TIER: "staging", NODE_ENV: undefined, FERRY_SCRUB_ERRORS: undefined });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('"error":"SyntaxError"');
    expect(r.out).not.toContain(MARKER);
  });
});
