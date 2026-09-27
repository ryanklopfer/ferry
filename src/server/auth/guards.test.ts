import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.join(process.cwd(), "src", "app");
const PUBLIC_PAGES = new Set(["sign-in/page.tsx", "(public)/offline/page.tsx"]);
const PUBLIC_ROUTES = new Set(["api/auth/[...all]/route.ts"]);

function find(dir: string, name: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return find(full, name);
    return e.name === name ? [path.relative(APP, full)] : [];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(APP, rel), "utf8");

// N2b makes these per-area: /app requireClinician, /c requireClient, /ops requireStaff.
const PAGE_GUARD = /\brequire(Clinician|Client|Staff|SignedIn)\(/;
const ROUTE_GUARD = /\b(getClinician|getSessionUser|require(Clinician|Client|Staff|SignedIn))\(/;
const ACTION_GUARD = /^ {2}(const \w+ = )?await require(Clinician|Client|Staff|SignedIn)\(\);$/gm;
// The phone spike's pages have no session; they 404 unless the dev tier and this run's key check passes.
const DEV_SPIKE = /^(api\/)?dev\//;
const SPIKE_GUARD = /\bspikeKeyValid\(/;
const guarded = (p: string, guard: RegExp) => (DEV_SPIKE.test(p) ? SPIKE_GUARD : guard).test(read(p));

// A new page, route or action that forgets the session check fails here, not in production.
describe("every entry point verifies the session", () => {
  it("pages call a require guard", () => {
    const unguarded = find(APP, "page.tsx").filter((p) => !PUBLIC_PAGES.has(p) && !guarded(p, PAGE_GUARD));
    expect(unguarded).toEqual([]);
  });

  it("route handlers check the session", () => {
    const unguarded = find(APP, "route.ts").filter((p) => !PUBLIC_ROUTES.has(p) && !guarded(p, ROUTE_GUARD));
    expect(unguarded).toEqual([]);
  });

  it("every server action starts with a require guard", () => {
    const files = [...find(APP, "actions.ts")].filter((p) => read(p).startsWith('"use server"'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = read(file);
      const actions = source.match(/^export async function \w+/gm) ?? [];
      const checks = source.match(ACTION_GUARD) ?? [];
      expect(actions.length, `${file} exports no actions`).toBeGreaterThan(0);
      expect(checks.length, `${file}: every action must start with await requireClinician() (or another require guard)`).toBe(actions.length);
    }
  });
});
