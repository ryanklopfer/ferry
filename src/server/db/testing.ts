import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import type { ClinicianCtx, Role, SelfCtx, StaffCtx } from "@/server/auth/ctx";
import { isSealed, keyIdOf, open } from "@/server/crypto/aead";
import { ephemeralKeyId } from "@/server/crypto/ephemeral";
import { ephemeralKeyStore } from "@/server/crypto";
import { sentInThisProcess } from "@/server/integrations/email";
import { liveText } from "@/server/legal";
import { sealContext } from "./codec";
import { AUTH_TABLES, EPHEMERAL, SEALED } from "./columns";
import { databaseUrl } from "./env";
import { db, pool } from "./index";
import { newId } from "./ids";
import { claimsRepo } from "./repos/claims";
import { clientsRepo } from "./repos/clients";
import { eventsRepo } from "./repos/events";
import { followUpsRepo } from "./repos/follow-ups";
import { plansRepo } from "./repos/plans";
import { clinicianProfilesRepo, type ProfileValues } from "./repos/clinician-profiles";
import { clinicianConsentsRepo } from "./repos/consents";
import { feeScheduleRepo } from "./repos/fee-schedule";
import { keyringFor, tenantKeysRepo } from "./repos/tenant-keys";
import { clientMemberships, clients, users } from "./schema";

export async function resetDb(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>("select current_database() as name");
  if (!rows[0].name.endsWith("_test")) throw new Error(`resetDb refused: "${rows[0].name}" is not a test database`);
  const tables = await pool.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public'");
  if (!tables.rows.length) return;
  const list = tables.rows.map((t) => `"${t.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

type TestUser = { pending: { userId: string }; clinician: ClinicianCtx; client: SelfCtx; staff: StaffCtx };

export async function createTestUser<R extends Role>(role: R, email = `${role}-${randomBytes(4).toString("hex")}@example.test`): Promise<TestUser[R]> {
  const id = `usr_test_${randomBytes(8).toString("hex")}`;
  await db.insert(users).values({ id, name: "", email, emailVerified: true, role });
  if (role === "clinician") await tenantKeysRepo.create({ scope: "clinician", userId: id });
  const byRole: TestUser = { pending: { userId: id }, clinician: { scope: "clinician", userId: id }, client: { scope: "self", userId: id }, staff: { scope: "staff", userId: id } };
  return byRole[role];
}

// Signs in through the real magic-link flow (fixture email) and returns request headers carrying the session cookie.
export async function signedInHeaders(email: string): Promise<Headers> {
  sentInThisProcess.length = 0;
  await auth.api.signInMagicLink({ body: { email, callbackURL: "/" }, headers: new Headers() });
  const link = new URL(sentInThisProcess.at(-1)!.text.match(/https?:\/\/\S+/)![0]);
  const query = Object.fromEntries(link.searchParams) as { token: string; callbackURL?: string };
  const response = await auth.api.magicLinkVerify({ query, headers: new Headers(), asResponse: true });
  const cookie = response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return new Headers({ cookie });
}

// Binds a client user to a clinician's client row and returns the active membership id. acceptInvite (N7a) does this
// for real; tests and demo:seed stand in for it.
export async function bindClientUser(clinician: ClinicianCtx, clientId: string, self: SelfCtx): Promise<string> {
  return db.transaction(async (tx) => {
    const bound = await tx.update(clients).set({ clientUserId: self.userId }).where(and(eq(clients.id, clientId), eq(clients.userId, clinician.userId))).returning({ id: clients.id });
    if (!bound.length) throw new Error(`bindClientUser: ${clientId} is not ${clinician.userId}'s client`);
    const [m] = await tx.insert(clientMemberships).values({ id: newId("mbr"), userId: self.userId, clinicianUserId: clinician.userId, clientId }).returning({ id: clientMemberships.id });
    return m.id;
  });
}

// What an attacker holding a copy of the database (a backup, a snapshot, a dump) would see: pg_dump of ferry_test's
// public and pgboss schemas, auth tables excluded (users.email is plaintext by decision; see columns.ts).
export function rawDump(): string {
  const url = databaseUrl();
  if (!/_test$/.test(new URL(url).pathname)) throw new Error("rawDump runs only against a test database");
  const args = ["--no-owner", "--no-privileges", "--schema=public", "--schema=pgboss", ...AUTH_TABLES.map((t) => `--exclude-table=public.${t}`), url];
  const out = spawnSync(process.env.PG_DUMP || "pg_dump", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (out.status !== 0) throw new Error(`pg_dump failed: ${out.stderr || out.error?.message}`);
  return out.stdout;
}

// What the tenant key can read: every SEALED value of the tenant's rows opened with its key, and every EPHEMERAL
// value opened when its record key still exists (expired or not). Erasure tests assert on what is missing here.
export async function decryptedDump(tenantId: string): Promise<string> {
  const ring = await keyringFor({ scope: "clinician", userId: tenantId });
  const store = ephemeralKeyStore();
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const table of new Set([...Object.keys(SEALED), ...Object.keys(EPHEMERAL)])) {
    const { rows } = await pool.query<Record<string, unknown>>(`select * from "${table}" where user_id = $1 order by id`, [tenantId]);
    out[table] = [];
    for (const row of rows) {
      const opened: Record<string, unknown> = { ...row };
      for (const col of SEALED[table] ?? []) if (isSealed(row[col])) opened[col] = JSON.parse(open(ring.data, row[col], sealContext(table, col, String(row.id))));
      for (const col of EPHEMERAL[table] ?? []) {
        const v = row[col];
        if (!isSealed(v)) continue;
        const recordId = keyIdOf(v).replace(/^e-/, "");
        const found = await store.get(recordId);
        opened[col] = found ? open({ id: ephemeralKeyId(recordId), bytes: found.key }, v) : null;
      }
      out[table].push(opened);
    }
  }
  return JSON.stringify(out);
}

export type SyntheticPerson = { firstName: string; lastName: string; email: string; phone: string; dob: string; memberId: string; groupNumber: string; diagnosis: string; taxId: string };

// A client with a plan and one claim (billing snapshot included) with a line, follow-up and event, written through
// the repos as the app would. Synthetic people only.
export async function seedSyntheticClient(ctx: ClinicianCtx, p: SyntheticPerson) {
  const name = `${p.firstName} ${p.lastName}`;
  const client = await clientsRepo.create(ctx, { firstName: p.firstName, lastName: p.lastName, dob: p.dob, email: p.email, phone: p.phone });
  const plan = await plansRepo.create(ctx, client.id, { insurerName: "Cigna", memberId: p.memberId, groupNumber: p.groupNumber, subscriberName: name, subscriberDob: p.dob, patientName: name, patientDob: p.dob, patientEmail: p.email, patientPhone: p.phone });
  const claim = await claimsRepo.create(
    ctx,
    { planId: plan.id, billingProviderName: "Rachel Steinberg, LCSW", billingProviderNpi: "1999000023", billingProviderTaxId: p.taxId, billingProviderTaxIdType: "EIN", diagnosisCodes: [p.diagnosis], totalCharged: 17500 },
    [{ serviceDate: "2026-09-15", cptCode: "90837", modifiers: [], description: "Psychotherapy, 60 min", units: 1, charge: 17500, diagnosisPointers: [1], placeOfService: "11" }],
  );
  await followUpsRepo.createMany(ctx, claim.id, [{ type: "status_inquiry", dueAt: new Date("2026-10-15T00:00:00Z") }]);
  await eventsRepo.append(ctx, claim.id, "created", `Claim for ${name}`);
  return { client, plan, claim };
}

// The clinician's practice profile, as onboarding saves it. NPIs are unique across tenants, so give each clinician
// in a test its own. Synthetic values only.
export async function seedClinicianProfile(ctx: ClinicianCtx, over: Partial<ProfileValues> = {}) {
  return clinicianProfilesRepo.create(ctx, {
    legalName: "Rachel Steinberg",
    credential: "LCSW",
    npi: "1999000023",
    npiType: "individual",
    taxonomyCode: "1041C0700X",
    groupName: null,
    groupNpi: null,
    taxId: "900114242",
    taxIdType: "SSN",
    practiceAddress: { line1: "2 Practice St", line2: null, city: "Oakland", state: "CA", zip: "94610" },
    licenseState: "CA",
    licenseNumber: "LCS 88213",
    defaultNoteFormat: "dap",
    defaultModality: "in_person",
    ...over,
  });
}

// A clinician who has finished onboarding: terms and BAA signed to the live texts, a profile and one fee, marked
// onboarded. Specs that start past onboarding (the reconsent walkthrough, later M1) begin here.
export async function seedOnboardedClinician(ctx: ClinicianCtx, over: Partial<ProfileValues> = {}) {
  const signed = await Promise.all(
    (["terms", "baa"] as const).map(async (docType) => {
      const { doc, hash } = await liveText(docType);
      return { docType, version: doc.version, contentHash: hash, typedName: "Rachel Steinberg", ip: null, userAgent: null };
    }),
  );
  await clinicianConsentsRepo.createAll(ctx, signed);
  const profile = await seedClinicianProfile(ctx, over);
  await feeScheduleRepo.replace(ctx, [{ cptCode: "90837", chargeCents: 17500 }]);
  await clinicianProfilesRepo.markOnboarded(ctx, new Date());
  return profile;
}
