import { afterAll, describe, expect, it } from "vitest";
import { pool } from "@/server/db";
import { CLIENT_ID_NULLABLE, CLIENT_SCOPED, CLIENT_SELF, GLOBAL_TABLES } from "./repos/scope";

const AUTH_TABLES = ["users", "sessions", "accounts", "verifications", "passkeys"];
// user_id here is the client user, not a tenant; it is still NOT NULL (checked below).
const MEMBERSHIPS = "client_memberships";

type TableRow = {
  table_name: string;
  user_id_nullable: string | null;
  user_id_fk: boolean;
  client_id_nullable: string | null;
  client_id_fk: boolean;
  client_id_check: boolean;
};

type Lists = { clientScoped: readonly string[]; clientSelf: readonly string[]; global: readonly string[]; nullable: readonly string[] };
const REAL: Lists = { clientScoped: CLIENT_SCOPED, clientSelf: CLIENT_SELF, global: GLOBAL_TABLES, nullable: CLIENT_ID_NULLABLE };

// Every table belongs to a user, and every table about one client says which client. A new table that
// forgets either is a tenant-isolation hole; this fails before it ships.
function scopeViolations(rows: TableRow[], lists: Lists = REAL): string[] {
  const names = rows.map((r) => r.table_name);
  const out: string[] = [];
  for (const t of [...lists.clientScoped, ...lists.clientSelf, ...lists.global, ...lists.nullable]) if (!names.includes(t)) out.push(`${t}: listed but missing`);
  for (const t of lists.nullable) if (!lists.clientScoped.includes(t)) out.push(`${t}: a nullable exception must be CLIENT_SCOPED`);
  for (const r of rows) {
    const t = r.table_name;
    if (AUTH_TABLES.includes(t) || lists.global.includes(t)) continue;
    if (r.user_id_nullable !== "NO" || !r.user_id_fk) out.push(`${t}: needs user_id NOT NULL referencing users`);
    if (t === MEMBERSHIPS) continue;
    if (lists.clientScoped.includes(t)) {
      if (r.client_id_nullable === null) out.push(`${t}: CLIENT_SCOPED but has no client_id`);
      else if (!r.client_id_fk) out.push(`${t}: client_id must reference clients`);
      if (r.client_id_nullable === "YES" && !lists.nullable.includes(t)) out.push(`${t}: client_id must be NOT NULL`);
      if (r.client_id_nullable === "YES" && lists.nullable.includes(t) && !r.client_id_check) out.push(`${t}: a nullable client_id needs a CHECK`);
    } else if (r.client_id_nullable !== null && !lists.clientSelf.includes(t)) out.push(`${t}: has client_id but is not on CLIENT_SCOPED`);
  }
  return out;
}

const ok: TableRow = { table_name: "", user_id_nullable: "NO", user_id_fk: true, client_id_nullable: "NO", client_id_fk: true, client_id_check: false };
const lists = (over: Partial<Lists> = {}): Lists => ({ clientScoped: ["claims", "tasks"], clientSelf: ["clients"], global: ["payers"], nullable: ["tasks"], ...over });
const world = (over: Partial<Record<string, Partial<TableRow>>> = {}): TableRow[] =>
  [
    { ...ok, table_name: "users", user_id_nullable: null, user_id_fk: false, client_id_nullable: null },
    { ...ok, table_name: "clients", client_id_nullable: null },
    { ...ok, table_name: "client_memberships" },
    { ...ok, table_name: "claims" },
    { ...ok, table_name: "tasks", client_id_nullable: "YES", client_id_check: true },
    { ...ok, table_name: "payers", user_id_nullable: null, user_id_fk: false, client_id_nullable: null },
    { ...ok, table_name: "fee_schedule_items", client_id_nullable: null },
  ].map((r) => ({ ...r, ...over[r.table_name] }));

describe("the scope checker", () => {
  it("passes a well-formed world", () => {
    expect(scopeViolations(world(), lists())).toEqual([]);
  });

  it("fails a CLIENT_SCOPED table whose client_id is nullable, missing or unreferenced", () => {
    expect(scopeViolations(world({ claims: { client_id_nullable: "YES" } }), lists())).toEqual(["claims: client_id must be NOT NULL"]);
    expect(scopeViolations(world({ claims: { client_id_nullable: null } }), lists())).toEqual(["claims: CLIENT_SCOPED but has no client_id"]);
    expect(scopeViolations(world({ claims: { client_id_fk: false } }), lists())).toEqual(["claims: client_id must reference clients"]);
  });

  it("accepts a listed nullable exception only with a CHECK", () => {
    expect(scopeViolations(world({ tasks: { client_id_check: false } }), lists())).toEqual(["tasks: a nullable client_id needs a CHECK"]);
    expect(scopeViolations(world(), lists({ nullable: [] }))).toEqual(["tasks: client_id must be NOT NULL"]);
  });

  it("exempts CLIENT_SELF from client_id and fails an unlisted table that has one", () => {
    expect(scopeViolations(world({ clients: { client_id_nullable: null } }), lists())).toEqual([]);
    expect(scopeViolations(world({ fee_schedule_items: { client_id_nullable: "NO" } }), lists())).toEqual(["fee_schedule_items: has client_id but is not on CLIENT_SCOPED"]);
  });

  it("fails any table outside the auth tables and GLOBAL_TABLES without user_id NOT NULL", () => {
    expect(scopeViolations(world({ fee_schedule_items: { user_id_nullable: "YES" } }), lists())).toEqual(["fee_schedule_items: needs user_id NOT NULL referencing users"]);
    expect(scopeViolations(world({ fee_schedule_items: { user_id_nullable: null, user_id_fk: false } }), lists())).toEqual(["fee_schedule_items: needs user_id NOT NULL referencing users"]);
    expect(scopeViolations(world({ clients: { user_id_fk: false } }), lists())).toEqual(["clients: needs user_id NOT NULL referencing users"]);
    expect(scopeViolations(world({ payers: { user_id_nullable: null } }), lists())).toEqual([]);
    expect(scopeViolations(world(), lists({ global: [] }))).toEqual(["payers: needs user_id NOT NULL referencing users"]);
  });

  it("fails a list that names a missing table", () => {
    expect(scopeViolations(world(), lists({ clientScoped: ["claims", "tasks", "gone"] }))).toEqual(["gone: listed but missing"]);
  });
});

describe("the ferry_test schema", () => {
  afterAll(() => pool.end());

  it("has an owner on every table and a client on every client-scoped one", async () => {
    const fk = (column: string, target: string) => `exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage k on k.constraint_name = tc.constraint_name and k.table_schema = tc.table_schema
      join information_schema.constraint_column_usage u on u.constraint_name = tc.constraint_name and u.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
        and tc.table_name = t.table_name and k.column_name = '${column}' and u.table_name = '${target}'
    )`;
    const nullable = (column: string) => `(select c.is_nullable from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = '${column}')`;
    const { rows } = await pool.query<TableRow>(`
      select t.table_name,
             ${nullable("user_id")} as user_id_nullable,
             ${fk("user_id", "users")} as user_id_fk,
             ${nullable("client_id")} as client_id_nullable,
             ${fk("client_id", "clients")} as client_id_fk,
             exists (
               select 1 from pg_constraint k
               join pg_class r on r.oid = k.conrelid
               join pg_namespace n on n.oid = r.relnamespace
               where n.nspname = 'public' and r.relname = t.table_name and k.contype = 'c' and pg_get_constraintdef(k.oid) like '%client_id%'
             ) as client_id_check
      from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    `);
    expect(rows.filter((r) => !AUTH_TABLES.includes(r.table_name)).length).toBeGreaterThan(0);
    expect(scopeViolations(rows)).toEqual([]);
    expect(rows.find((r) => r.table_name === MEMBERSHIPS)).toMatchObject({ user_id_nullable: "NO", user_id_fk: true, client_id_nullable: "NO", client_id_fk: true });
  });
});
