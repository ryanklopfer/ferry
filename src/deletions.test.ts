import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "@/server/db";
import * as schema from "@/server/db/schema";

const SRC = path.join(process.cwd(), "src");
const SELF = path.join(SRC, "deletions.test.ts");

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? files(full) : /\.(ts|tsx|mts|js|mjs)$/.test(e.name) ? [full] : [];
  });
}

const rel = (full: string) => path.relative(process.cwd(), full);

// The patient MVP showed the full Tax ID and stored superbill uploads as plaintext files. N2b removed both.
describe("patient MVP surface is gone", () => {
  afterAll(() => pool.end());

  it("no file under src/app references billingProviderTaxId", () => {
    expect(files(path.join(SRC, "app")).filter((f) => fs.readFileSync(f, "utf8").includes("billingProviderTaxId")).map(rel)).toEqual([]);
  });

  it("src/server/storage/local.ts no longer exists", () => {
    expect(fs.existsSync(path.join(SRC, "server", "storage", "local.ts"))).toBe(false);
  });

  it("the documents table no longer exists, in the schema or the database", async () => {
    expect(Object.keys(schema)).not.toContain("documents");
    const { rows } = await pool.query("select 1 from information_schema.tables where table_schema = 'public' and table_name = 'documents'");
    expect(rows).toEqual([]);
  });

  it("no src file imports putFile", () => {
    expect(files(SRC).filter((f) => f !== SELF && /\bputFile\b/.test(fs.readFileSync(f, "utf8"))).map(rel)).toEqual([]);
  });
});
