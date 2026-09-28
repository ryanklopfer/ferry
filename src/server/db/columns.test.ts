import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { isSealed } from "@/server/crypto/aead";
import { pool } from "@/server/db";
import { claimsRepo } from "./repos/claims";
import { clientsRepo } from "./repos/clients";
import { eventsRepo } from "./repos/events";
import { followUpsRepo } from "./repos/follow-ups";
import { plansRepo } from "./repos/plans";
import { providersRepo } from "./repos/providers";
import { AUTH_TABLES, BLIND_INDEXES, EPHEMERAL, LAST4_OF, PLAINTEXT_OK, SEALED, SEALED_DEFAULTS } from "./columns";
import { createTestUser, resetDb } from "./testing";

type ColumnRow = { table_name: string; column_name: string; data_type: string };
type Lists = { sealed: Record<string, readonly string[]>; ephemeral: Record<string, readonly string[]>; plaintext: Record<string, Record<string, string>> };
const REAL: Lists = { sealed: SEALED, ephemeral: EPHEMERAL, plaintext: PLAINTEXT_OK };

// Every text, jsonb, bytea or text[] column outside the auth tables is in exactly one list, and sealed ones are
// text so ciphertext fits. A new column that nobody classified fails here before it can hold PHI in the clear.
function classificationViolations(rows: ColumnRow[], lists: Lists = REAL): string[] {
  const out: string[] = [];
  const listed = new Map<string, string[]>();
  const add = (kind: string, t: string, c: string) => listed.set(`${t}.${c}`, [...(listed.get(`${t}.${c}`) ?? []), kind]);
  for (const [t, cols] of Object.entries(lists.sealed)) for (const c of cols) add("SEALED", t, c);
  for (const [t, cols] of Object.entries(lists.ephemeral)) for (const c of cols) add("EPHEMERAL", t, c);
  for (const [t, cols] of Object.entries(lists.plaintext)) for (const [c, reason] of Object.entries(cols)) {
    add("PLAINTEXT_OK", t, c);
    if (!reason.trim()) out.push(`${t}.${c}: PLAINTEXT_OK needs a reason`);
  }
  const present = new Map(rows.map((r) => [`${r.table_name}.${r.column_name}`, r]));
  for (const [key, kinds] of listed) {
    const table = key.split(".")[0];
    if ((AUTH_TABLES as readonly string[]).includes(table)) out.push(`${key}: auth tables are excluded by name, not classified`);
    else if (!present.has(key)) out.push(`${key}: listed but missing`);
    if (kinds.length > 1) out.push(`${key}: listed in ${kinds.join(" and ")}`);
    if (kinds.some((k) => k !== "PLAINTEXT_OK") && present.get(key) && present.get(key)!.data_type !== "text") out.push(`${key}: SEALED and EPHEMERAL columns must be text`);
  }
  for (const r of rows) {
    if ((AUTH_TABLES as readonly string[]).includes(r.table_name)) continue;
    if (!listed.has(`${r.table_name}.${r.column_name}`)) out.push(`${r.table_name}.${r.column_name}: unclassified`);
  }
  return out;
}

const col = (table_name: string, column_name: string, data_type = "text"): ColumnRow => ({ table_name, column_name, data_type });
const world = [col("users", "email"), col("clients", "id"), col("clients", "first_name"), col("notes", "body"), col("notes", "meta", "jsonb")];
const lists = (over: Partial<Lists> = {}): Lists => ({ sealed: { clients: ["first_name"], notes: ["meta"] }, ephemeral: { notes: ["body"] }, plaintext: { clients: { id: "opaque id" } }, ...over });

describe("the column classifier", () => {
  it("passes a fully classified world and ignores the auth tables", () => {
    expect(classificationViolations(world, { ...lists(), sealed: { clients: ["first_name"] }, plaintext: { clients: { id: "opaque id" }, notes: { meta: "fixture" } } })).toEqual([]);
  });

  it("fails a column in no list", () => {
    expect(classificationViolations([...world, col("clients", "nickname")], { ...lists(), sealed: { clients: ["first_name"] }, plaintext: { clients: { id: "x" }, notes: { meta: "x" } } })).toEqual(["clients.nickname: unclassified"]);
  });

  it("fails a column in two lists, a stale entry, a blank reason, an auth table and a non-text sealed column", () => {
    expect(classificationViolations(world, lists({ plaintext: { clients: { id: "x", first_name: "x" } } }))).toEqual(["clients.first_name: listed in SEALED and PLAINTEXT_OK", "notes.meta: SEALED and EPHEMERAL columns must be text"]);
    expect(classificationViolations(world, lists({ plaintext: { clients: { id: "x", gone: "x" } } }))).toContain("clients.gone: listed but missing");
    expect(classificationViolations(world, lists({ plaintext: { clients: { id: " " } } }))).toContain("clients.id: PLAINTEXT_OK needs a reason");
    expect(classificationViolations(world, lists({ plaintext: { clients: { id: "x" }, users: { email: "x" } } }))).toContain("users.email: auth tables are excluded by name, not classified");
  });
});

describe("the ferry_test schema", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("classifies every text, jsonb, bytea and text[] column outside the auth tables", async () => {
    const { rows } = await pool.query<ColumnRow>(`
      select c.table_name, c.column_name, case when c.data_type = 'ARRAY' then c.udt_name else c.data_type end as data_type
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public'
        and (c.data_type in ('text', 'character varying', 'character', 'jsonb', 'json', 'bytea') or c.udt_name in ('_text', '_varchar', '_jsonb', '_json', '_bytea'))
    `);
    expect(rows.length).toBeGreaterThan(50);
    expect(classificationViolations(rows)).toEqual([]);
  });

  it("classifies the MVP's free-text columns until S10 drops them", () => {
    expect(SEALED.claims).toEqual(expect.arrayContaining(["extraction_notes", "info_requested", "confirmation_number"]));
    expect(SEALED.events).toContain("note");
  });

  it("derives blind indexes and last fours only from sealed columns, into plaintext ones, and defaults only sealed ones", () => {
    for (const [t, targets] of Object.entries({ ...BLIND_INDEXES })) {
      for (const [target, { source }] of Object.entries(targets)) {
        expect(SEALED[t], `${t}.${source}`).toContain(source);
        expect(PLAINTEXT_OK[t]?.[target], `${t}.${target}`).toBeTruthy();
      }
    }
    for (const [t, targets] of Object.entries(LAST4_OF)) {
      for (const [target, source] of Object.entries(targets)) {
        expect(SEALED[t], `${t}.${source}`).toContain(source);
        expect(PLAINTEXT_OK[t]?.[target], `${t}.${target}`).toBeTruthy();
      }
    }
    for (const [t, cols] of Object.entries(SEALED_DEFAULTS)) for (const c of Object.keys(cols)) expect(SEALED[t]).toContain(c);
  });

  it("stores every sealed column as a v1 sealed value after a write through the repos", async () => {
    const x = await createTestUser("clinician");
    const client = await clientsRepo.create(x, { firstName: "Marisol", lastName: "Quintero", dob: "1991-02-03", email: "marisol@example.test", phone: "555-0100" });
    const plan = await plansRepo.create(x, client.id, {
      insurerName: "Cigna",
      memberId: "U8841207733",
      groupNumber: "G-778812",
      subscriberName: "Marisol Quintero",
      subscriberDob: "1991-02-03",
      patientName: "Marisol Quintero",
      patientDob: "1991-02-03",
      patientAddress: "1 Synthetic Way",
      patientPhone: "555-0100",
      patientEmail: "marisol@example.test",
    });
    const provider = await providersRepo.upsertByNpiOrName(x, { name: "Rachel Steinberg, LCSW", npi: "1999000023", taxId: "00-1000002", taxIdType: "EIN", address: "2 Practice St", phone: "555-0101" });
    const claim = await claimsRepo.create(
      x,
      {
        planId: plan.id,
        billingProviderId: provider.id,
        billingProviderTaxId: "00-1000002",
        billingProviderAddress: "2 Practice St",
        billingProviderPhone: "555-0101",
        diagnosisCodes: ["F41.1"],
        extractionNotes: "read from a synthetic superbill",
        confirmationNumber: "CN-1",
        denialReason: "synthetic reason",
        infoRequested: "synthetic request",
      },
      [{ serviceDate: "2026-09-15", cptCode: "90834", modifiers: [], description: "Psychotherapy, 45 min", units: 1, charge: 17500, diagnosisPointers: [1], placeOfService: "11" }],
    );
    const [followUp] = await followUpsRepo.createMany(x, claim.id, [{ type: "status_inquiry", dueAt: new Date() }]);
    await followUpsRepo.update(x, followUp.id, { draftSubject: "Claim status", draftBody: "Synthetic body" });
    await eventsRepo.append(x, claim.id, "created", "synthetic note");

    for (const [table, cols] of Object.entries(SEALED)) {
      const { rows } = await pool.query<Record<string, unknown>>(`select ${cols.map((c) => `"${c}"`).join(", ")} from "${table}" where user_id = $1`, [x.userId]);
      expect(rows.length, table).toBeGreaterThan(0);
      for (const row of rows) for (const c of cols) expect(isSealed(row[c]), `${table}.${c} = ${String(row[c]).slice(0, 12)}`).toBe(true);
    }
    const { rows } = await pool.query("select tax_id_last4 from providers where user_id = $1 union all select billing_provider_tax_id_last4 from claims where user_id = $1", [x.userId]);
    expect(rows.map((r) => Object.values(r)[0])).toEqual(["0002", "0002"]);
  });
});
