import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sealEphemeral } from "@/server/crypto/ephemeral";
import { ephemeralKeyStore } from "@/server/crypto";
import { keyDir } from "@/server/crypto/key-provider";
import { tenantKeyring } from "@/server/crypto/tenant-keys";
import { pool } from "@/server/db";
import { createTestUser, decryptedDump, rawDump, resetDb, seedSyntheticClient, type SyntheticPerson } from "./testing";

// Long, distinctive synthetic values, so a chance match inside base64 ciphertext is out of the question.
const PEOPLE: SyntheticPerson[] = [
  { firstName: "Marisol", lastName: "Quintero", email: "marisol.quintero@example.test", phone: "555-010-4477", dob: "1991-02-03", memberId: "W8841207733", groupNumber: "GRP-5512093", diagnosis: "F41.1", taxId: "00-1000002" },
  { firstName: "Thaddeus", lastName: "Okonkwo", email: "thaddeus.okonkwo@example.test", phone: "555-010-8812", dob: "1985-07-19", memberId: "U5530981264", groupNumber: "GRP-3301877", diagnosis: "F33.1", taxId: "00-1000003" },
  { firstName: "Ingeborg", lastName: "Castellanos", email: "ingeborg.castellanos@example.test", phone: "555-010-2290", dob: "1979-11-30", memberId: "H7720045519", groupNumber: "GRP-9087741", diagnosis: "F43.23", taxId: "00-1000004" },
];

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
    await seedSyntheticClient(x, PEOPLE[0]);
    await seedSyntheticClient(x, PEOPLE[1]);
    await seedSyntheticClient(y, PEOPLE[2]);
    for (const id of recordIds) await sealEphemeral(ephemeralKeyStore(), id, "Client describes panic attacks on the train", new Date(Date.now() + 3_600_000));
    dump = rawDump();
  });
  afterAll(async () => {
    for (const id of recordIds) await ephemeralKeyStore().destroy(id);
    await pool.end();
  });

  it("is a real dump of the seeded tables", () => {
    for (const table of ["clients", "plans", "claims", "claim_lines", "events", "follow_ups", "providers", "tenant_keys"]) expect(dump).toContain(`COPY public.${table} `);
    expect(dump).toContain("Rachel Steinberg, LCSW");
    expect(dump).not.toContain("COPY public.users ");
  });

  it("contains none of the seeded client names, emails, member IDs, diagnosis codes or Tax IDs", () => {
    const leaks = PEOPLE.flatMap((p) => [p.firstName, p.lastName, `${p.firstName} ${p.lastName}`, p.email, p.phone, p.memberId, p.groupNumber, p.diagnosis, p.taxId, p.taxId.replace("-", "")]).filter((v) => dump.includes(v));
    expect(leaks).toEqual([]);
    expect(dump).not.toContain("90837");
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
      const ring = await tenantKeyring(t);
      found.push(...[...variants(ring.data.bytes), ...variants(ring.index)].filter((v) => dump.includes(v)));
    }
    expect(found).toEqual([]);
  });
});
