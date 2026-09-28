import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOM_INCLUDE, NODE_INCLUDE } from "../vitest.globs.mjs";

const root = path.join(__dirname, "..");
const ignored = (file: string) => spawnSync("git", ["check-ignore", "-q", file], { cwd: root }).status;

describe("repo hygiene", () => {
  it("tracks reference data but ignores local runtime data", () => {
    expect(ignored("data/payers/x.json")).toBe(1);
    expect(ignored("data/codes/x.json")).toBe(1);
    expect(ignored("data/outbox/x.json")).toBe(0);
    expect(ignored("data/uploads/x.pdf")).toBe(0);
    expect(ignored("data/keys/kek")).toBe(0);
    expect(ignored("data/keys/ephemeral/trn_x.json")).toBe(0);
    expect(ignored("data/e2e-keys/kek")).toBe(0);
  });

  it("runs every test file the sprint plan names", () => {
    const plan = fs.readFileSync(path.join(root, "docs/sprint-tasks.md"), "utf8");
    const named = [...new Set([...plan.matchAll(/(?<![\w./-])([\w./-]+\.(?:test|spec)\.(?:ts|tsx|mts|js))/g)].map((m) => m[1]))];
    expect(named.length).toBeGreaterThan(50);

    const config = fs.readFileSync(path.join(root, "playwright.config.ts"), "utf8");
    const testDir = config.match(/testDir:\s*"([^"]+)"/)?.[1];
    expect(testDir).toBe("e2e");
    const globs = [...NODE_INCLUDE, ...DOM_INCLUDE, `${testDir}/**/*.spec.ts`];

    // A bare file name has no directory yet, so it runs if it would run in src/ (tests) or e2e/ (specs).
    const runs = (name: string) => {
      const candidates = name.includes("/") ? [name] : [`src/${name}`, `${testDir}/${name}`];
      return candidates.some((c) => globs.some((g) => path.matchesGlob(c, g)));
    };
    expect(named.filter((n) => !runs(n))).toEqual([]);
  });

  it("rejects a test file that no runner would pick up", () => {
    const globs = [...NODE_INCLUDE, ...DOM_INCLUDE, "e2e/**/*.spec.ts"];
    for (const stray of ["tests/x.test.ts", "scripts/x.test.tsx", "src/x.spec.ts", "e2e/x.test.js"]) {
      expect(globs.some((g) => path.matchesGlob(stray, g)), stray).toBe(false);
    }
  });
});
