import { getTableColumns, getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { last4 } from "@/core/mask";
import { open, seal } from "@/server/crypto/aead";
import { blindIndex } from "@/server/crypto/blind";
import type { Keyring } from "@/server/crypto/tenant-keys";
import { BLIND_INDEXES, LAST4_OF, SEALED, SEALED_DEFAULTS } from "./columns";

// The one column codec. Repos call encodeRow on every insert or update and decodeRow on every row they return;
// what is sealed, indexed or reduced to a last four is declared only in columns.ts.
type Plan = {
  name: string;
  sealed: { key: string; sql: string }[];
  derived: { target: string; source: string; compute: (ring: Keyring, value: string) => string | null }[];
  defaults: [string, unknown][];
};

const plans = new Map<PgTable, Plan>();

function planFor(table: PgTable): Plan {
  const cached = plans.get(table);
  if (cached) return cached;
  const name = getTableName(table);
  const keyBySql = new Map(Object.entries(getTableColumns(table)).map(([key, column]) => [column.name, key]));
  const prop = (sql: string) => {
    const key = keyBySql.get(sql);
    if (!key) throw new Error(`columns.ts names ${name}.${sql}, which the schema doesn't have`);
    return key;
  };
  const plan: Plan = {
    name,
    sealed: (SEALED[name] ?? []).map((sql) => ({ key: prop(sql), sql })),
    derived: [
      ...Object.entries(BLIND_INDEXES[name] ?? {}).map(([target, { source, normalize }]) => ({
        target: prop(target),
        source: prop(source),
        compute: (ring: Keyring, value: string) => blindIndex(ring.index, `${name}.${source}`, normalize, value),
      })),
      ...Object.entries(LAST4_OF[name] ?? {}).map(([target, source]) => ({ target: prop(target), source: prop(source), compute: (_: Keyring, value: string) => last4(value) || null })),
    ],
    defaults: Object.entries(SEALED_DEFAULTS[name] ?? {}).map(([sql, value]) => [prop(sql), value]),
  };
  plans.set(table, plan);
  return plan;
}

// Every sealed value is bound to its table, column and row (the AEAD context), so a ciphertext copied into another
// row or column of the same tenant fails to open instead of reading as that row's value.
export const sealContext = (table: string, column: string, rowId: string) => `${table}.${column}#${rowId}`;

function rowIdOf(plan: Plan, values: Record<string, unknown>, id: string | undefined): string {
  const rowId = values.id ?? id;
  if (typeof rowId !== "string" || !rowId) throw new Error(`Sealing ${plan.name} needs the row id: pass { id } on update`);
  return rowId;
}

// Nulls stay SQL NULL; anything else is JSON, so a string[] or a date string comes back as it went in. An insert
// carries its id in values; an update passes { id }.
export function encodeRow<T extends object>(table: PgTable, ring: Keyring, values: T, { insert = false, id }: { insert?: boolean; id?: string } = {}): T {
  const plan = planFor(table);
  const out = { ...values } as Record<string, unknown>;
  if (insert) for (const [key, value] of plan.defaults) if (out[key] === undefined) out[key] = value;
  for (const d of plan.derived) {
    if (out[d.source] === undefined) continue;
    const v = out[d.source];
    out[d.target] = v === null || v === "" ? null : d.compute(ring, String(v));
  }
  for (const { key, sql } of plan.sealed) {
    const v = out[key];
    if (v !== undefined && v !== null) out[key] = seal(ring.data, JSON.stringify(v), sealContext(plan.name, sql, rowIdOf(plan, out, id)));
  }
  return out as T;
}

export function decodeRow<T extends object>(table: PgTable, ring: Keyring, row: T): T {
  const plan = planFor(table);
  const out = { ...row } as Record<string, unknown>;
  for (const { key, sql } of plan.sealed) {
    const v = out[key];
    if (typeof v === "string") out[key] = JSON.parse(open(ring.data, v, sealContext(plan.name, sql, rowIdOf(plan, out, undefined))));
  }
  return out as T;
}

export const decodeRows = <T extends object>(table: PgTable, ring: Keyring, rows: T[]): T[] => rows.map((r) => decodeRow(table, ring, r));

// The value a blind-index column holds for this input, for an equality lookup that decrypts nothing.
export function blindFor(table: PgTable, target: string, ring: Keyring, value: string): string {
  const d = planFor(table).derived.find((x) => x.target === target);
  if (!d) throw new Error(`${getTableName(table)}.${target} is not a blind index`);
  return d.compute(ring, value) ?? "";
}
