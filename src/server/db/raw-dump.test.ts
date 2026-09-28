import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientCtxFor } from "@/server/auth/client-ctx";
import { sealEphemeral } from "@/server/crypto/ephemeral";
import { ephemeralKeyStore } from "@/server/crypto";
import { keyDir } from "@/server/crypto/key-provider";
import { pool } from "@/server/db";
import { clientConsentsRepo, clinicianConsentsRepo } from "./repos/consents";
import { keyringFor } from "./repos/tenant-keys";
import { bindClientUser, createTestUser, decryptedDump, rawDump, resetDb, seedClinicianProfile, seedSyntheticClient, type SyntheticPerson } from "./testing";

// Long, distinctive synthetic values, so a chance match inside base64 ciphertext is out of the question.
const PEOPLE: SyntheticPerson[] = [
  { firstName: "Marisol", lastName: "Quintero", email: "marisol.quintero@example.test", phone: "555-010-4477", dob: "1991-02-03", memberId: "W8841207733", groupNumber: "GRP-5512093", diagnosis: "F41.1", taxId: "00-1000002" },
  { firstName: "Thaddeus", lastName: "Okonkwo", email: "thaddeus.okonkwo@example.test", phone: "555-010-8812", dob: "1985-07-19", memberId: "U5530981264", groupNumber: "GRP-3301877", diagnosis: "F33.1", taxId: "00-1000003" },
  { firstName: "Ingeborg", lastName: "Castellanos", email: "ingeborg.castellanos@example.test", phone: "555-010-2290", dob: "1979-11-30", memberId: "H7720045519", groupNumber: "GRP-9087741", diagnosis: "F43.23", taxId: "00-1000004" },
];

// Each clinician's own Tax ID (a solo clinician's is often their SSN) and practice address, from onboarding.
const PRACTICES = [
  { npi: "1999000023", taxId: "917-38-2046", taxIdType: "SSN", line1: "4471 Wexford Hollow Rd" },
  { npi: "1234567893", taxId: "83-6150297", taxIdType: "EIN", line1: "902 Quillfeather Ln" },
] as const;

// What a consent row keeps about the signer: typed name, IP address and browser, all sealed.
const SIGNER = { typedName: "Wilhelmina Achterberg-Solis", ip: "198.51.100.231", userAgent: "Mozilla/5.0 Ferry-Dump-Marker/7.3" };

const variants = (key: Buffer) => [key.toString("base64"), key.toString("base64url"), key.toString("hex"), key.subarray(0, 16).toString("base64"), key.subarray(16).toString("hex")];

describe("rawDump of a seeded ferry_test", () => {
  let dump: string;
  let tenants: string[];
  const recordIds = [`trn_${randomBytes(6).toString("hex")}`, `trn_${randomBytes(6).toString("hex")}`];

  beforeAll(async () => {
    await resetDb();
    const x = await createTestUser("clinician", "x@example.test");
    const y = await createTestUser("clinician", "y@example.test");
    tenants = [x.userId, y.userId];
    for (const [ctx, p] of [[x, PRACTICES[0]], [y, PRACTICES[1]]] as const) {
      await seedClinicianProfile(ctx, { npi: p.npi, taxId: p.taxId.replace(/\D/g, ""), taxIdType: p.taxIdType, practiceAddress: { line1: p.line1, line2: null, city: "Oakland", state: "CA", zip: "94610" } });
    }
    const a = await seedSyntheticClient(x, PEOPLE[0]);
    await seedSyntheticClient(x, PEOPLE[1]);
    await seedSyntheticClient(y, PEOPLE[2]);
    const consent = { ...SIGNER, version: "0.0.0", contentHash: "a".repeat(64) };
    await clinicianConsentsRepo.create(x, { ...consent, docType: "npi_filing_authorization" });
    const self = await createTestUser("client", "u@example.test");
    const k = await clientCtxFor(self, await bindClientUser(x, a.client.id, self));
    await clientConsentsRepo.create(k, { ...consent, docType: "client_recording", signerRelationship: "parent_guardian" });
    for (const id of recordIds) await sealEphemeral(ephemeralKeyStore(), id, "Client describes panic attacks on the train", new Date(Date.now() + 3_600_000));
    dump = rawDump();
  });
  afterAll(async () => {
    for (const id of recordIds) await ephemeralKeyStore().destroy(id);
    await pool.end();
  });

  it("is a real dump of the seeded tables", () => {
    for (const table of ["clients", "plans", "claims", "claim_lines", "events", "follow_ups", "clinician_profiles", "tenant_keys", "clinician_consents", "client_consents"]) expect(dump).toContain(`COPY public.${table} `);
    expect(dump).toContain("Rachel Steinberg, LCSW");
    expect(dump).not.toContain("COPY public.users ");
  });

  it("contains none of the seeded client names, emails, member IDs, diagnosis codes or Tax IDs", () => {
    const leaks = PEOPLE.flatMap((p) => [p.firstName, p.lastName, `${p.firstName} ${p.lastName}`, p.email, p.phone, p.memberId, p.groupNumber, p.diagnosis, p.taxId, p.taxId.replace("-", "")]).filter((v) => dump.includes(v));
    expect(leaks).toEqual([]);
    expect(dump).not.toContain("90837");
  });

  it("contains no clinician Tax ID or practice address, which the tenant key still reads", async () => {
    const leaks = PRACTICES.flatMap((p) => [p.taxId, p.taxId.replace(/\D/g, ""), p.taxId.replace(/\D/g, "").slice(0, 5), p.line1, "Wexford", "Quillfeather"]).filter((v) => dump.includes(v));
    expect(leaks).toEqual([]);
    expect(dump).toContain("2046");
    const [x, y] = await Promise.all(tenants.map(decryptedDump));
    expect(x).toContain("917382046");
    expect(x).toContain(PRACTICES[0].line1);
    expect(x).not.toContain("836150297");
    expect(y).toContain("836150297");
  });

  it("contains no consent signer's typed name, IP address or user agent, which the tenant key still reads", async () => {
    const leaks = [SIGNER.typedName, "Achterberg", SIGNER.ip, "Ferry-Dump-Marker", "Mozilla"].filter((v) => dump.includes(v));
    expect(leaks).toEqual([]);
    const x = await decryptedDump(tenants[0]);
    for (const v of Object.values(SIGNER)) expect(x).toContain(v);
  });

  it("still lets each tenant's key read its own rows, and only those", async () => {
    const [x, y] = await Promise.all(tenants.map(decryptedDump));
    for (const v of [PEOPLE[0].email, PEOPLE[1].memberId, PEOPLE[0].taxId, "F33.1"]) expect(x).toContain(v);
    expect(x).not.toContain(PEOPLE[2].lastName);
    expect(y).toContain(PEOPLE[2].memberId);
    expect(y).not.toContain(PEOPLE[0].lastName);
  });

  it("contains no ephemeral key material and no unwrapped tenant key", async () => {
    const found: string[] = [];
    for (const id of recordIds) {
      const { key } = JSON.parse(fs.readFileSync(path.join(keyDir(), "ephemeral", `${id}.json`), "utf8")) as { key: string };
      found.push(...variants(Buffer.from(key, "base64")).filter((v) => dump.includes(v)));
    }
    for (const t of tenants) {
      const ring = await keyringFor({ scope: "clinician", userId: t });
      found.push(...[...variants(ring.data.bytes), ...variants(ring.index)].filter((v) => dump.includes(v)));
    }
    expect(found).toEqual([]);
  });
});
