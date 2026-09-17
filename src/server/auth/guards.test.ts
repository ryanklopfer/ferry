import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.join(process.cwd(), "src", "app");
const PUBLIC_PAGES = new Set(["sign-in/page.tsx"]);
const PUBLIC_ROUTES = new Set(["api/auth/[...all]/route.ts"]);

function find(dir: string, name: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return find(full, name);
    return e.name === name ? [path.relative(APP, full)] : [];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(APP, rel), "utf8");

// A new page, route or action that forgets the session check fails here, not in production.
describe("every entry point verifies the session", () => {
  it("pages call requireCtx", () => {
    const unguarded = find(APP, "page.tsx").filter((p) => !PUBLIC_PAGES.has(p) && !read(p).includes("requireCtx("));
    expect(unguarded).toEqual([]);
  });

  it("route handlers call getCtx or requireCtx", () => {
    const unguarded = find(APP, "route.ts").filter((p) => !PUBLIC_ROUTES.has(p) && !/(getCtx|requireCtx)\(/.test(read(p)));
    expect(unguarded).toEqual([]);
  });

  it("every server action calls requireCtx", () => {
    const files = [...find(APP, "actions.ts")].filter((p) => read(p).startsWith('"use server"'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = read(file);
      const actions = source.match(/^export async function \w+/gm) ?? [];
      const checks = source.match(/^ {2}await requireCtx\(\);$/gm) ?? [];
      expect(actions.length, `${file} exports no actions`).toBeGreaterThan(0);
      expect(checks.length, `${file}: every action must start with await requireCtx()`).toBe(actions.length);
    }
  });
});
