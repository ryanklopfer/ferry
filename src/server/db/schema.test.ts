import { afterAll, describe, expect, it } from "vitest";
import { pool } from "@/server/db";

const AUTH_TABLES = ["users", "sessions", "accounts", "verifications", "passkeys"];
// Reference tables with no owner (payer directory, code sets). Adding one here is a reviewed decision.
const GLOBAL_TABLES: string[] = [];

// A new table without an owner is a tenant-isolation hole. This fails before it ships.
describe("every domain table belongs to a user", () => {
  afterAll(() => pool.end());

  it("has a NOT NULL user_id with a foreign key to users", async () => {
    const { rows } = await pool.query<{ table_name: string; nullable: string | null; has_fk: boolean }>(`
      select t.table_name,
             c.is_nullable as nullable,
             exists (
               select 1
               from information_schema.table_constraints tc
               join information_schema.key_column_usage k on k.constraint_name = tc.constraint_name and k.table_schema = tc.table_schema
               join information_schema.constraint_column_usage u on u.constraint_name = tc.constraint_name and u.table_schema = tc.table_schema
               where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
                 and tc.table_name = t.table_name and k.column_name = 'user_id' and u.table_name = 'users'
             ) as has_fk
      from information_schema.tables t
      left join information_schema.columns c on c.table_schema = t.table_schema and c.table_name = t.table_name and c.column_name = 'user_id'
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    `);
    const tables = rows.map((r) => r.table_name);
    for (const t of GLOBAL_TABLES) expect(tables, `GLOBAL_TABLES names a missing table: ${t}`).toContain(t);
    const domain = rows.filter((r) => !AUTH_TABLES.includes(r.table_name) && !GLOBAL_TABLES.includes(r.table_name));
    expect(domain.length).toBeGreaterThan(0);
    const unowned = domain.filter((r) => r.nullable !== "NO" || !r.has_fk).map((r) => r.table_name);
    expect(unowned).toEqual([]);
  });
});
