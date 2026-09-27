import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FIXTURE = path.join(__dirname, "__fixtures__", "crash.ts");
const MARKER = "Samira-Haddad-U4827193";

function run(how: string, extra: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", FERRY_DEPLOY_TIER: "dev", ...extra };
  delete env.VITEST;
  const r = spawnSync("bun", [FIXTURE, how, MARKER], { env, encoding: "utf8", timeout: 20_000 });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}`, stderr: r.stderr };
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

  it("scrubs console.error and console.warn to error names when FERRY_SCRUB_ERRORS=1", () => {
    const r = run("console", { FERRY_SCRUB_ERRORS: "1" });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('"error":"SyntaxError"');
    expect(r.out).not.toContain(MARKER);
  });
});
