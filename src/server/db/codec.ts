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
  sealed: string[];
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
    sealed: (SEALED[name] ?? []).map(prop),
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

// Nulls stay SQL NULL; anything else is JSON, so a string[] or a date string comes back as it went in.
export function encodeRow<T extends object>(table: PgTable, ring: Keyring, values: T, { insert = false } = {}): T {
  const plan = planFor(table);
  const out = { ...values } as Record<string, unknown>;
  if (insert) for (const [key, value] of plan.defaults) if (out[key] === undefined) out[key] = value;
  for (const d of plan.derived) {
    if (out[d.source] === undefined) continue;
    const v = out[d.source];
    out[d.target] = v === null || v === "" ? null : d.compute(ring, String(v));
  }
  for (const key of plan.sealed) {
    const v = out[key];
    if (v !== undefined && v !== null) out[key] = seal(ring.data, JSON.stringify(v));
  }
  return out as T;
}

export function decodeRow<T extends object>(table: PgTable, ring: Keyring, row: T): T {
  const plan = planFor(table);
  const out = { ...row } as Record<string, unknown>;
  for (const key of plan.sealed) {
    const v = out[key];
    if (typeof v === "string") out[key] = JSON.parse(open(ring.data, v));
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
