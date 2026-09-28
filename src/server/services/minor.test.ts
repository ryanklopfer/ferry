import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { SignerRelationship } from "@/core/legal";
import { clientCtxFor } from "@/server/auth/client-ctx";
import type { ClientCtx, ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { clientsRepo } from "@/server/db/repos/clients";
import { bindClientUser, createTestUser, resetDb } from "@/server/db/testing";
import { liveText } from "@/server/legal";
import { recordConsent } from "./consents";

// 17 and 18 years before today (UTC), so the test holds on any day it runs.
const yearsAgo = (n: number, days = 0) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describe("a client under 18", () => {
  let x: ClinicianCtx;

  async function clientBornOn(dob: string | null): Promise<ClientCtx> {
    const client = await clientsRepo.create(x, { firstName: "Theo", lastName: "Park", dob, email: null, phone: null });
    const self = await createTestUser("client");
    return clientCtxFor(self, await bindClientUser(x, client.id, self));
  }

  const sign = async (k: ClientCtx, signerRelationship: SignerRelationship) =>
    recordConsent(k, { docType: "client_recording", typedName: "Synthetic Signer", shownHash: (await liveText("client_recording")).hash, signerRelationship, ip: null, userAgent: null });

  beforeEach(async () => {
    await resetDb();
    x = await createTestUser("clinician");
  });
  afterAll(() => pool.end());

  it("refuses a 'self' signer and accepts a parent or guardian", async () => {
    const minor = await clientBornOn(yearsAgo(17));
    await expect(sign(minor, "self")).rejects.toMatchObject({ name: "ConsentRefused", reason: "minor_self" });
    await expect(sign(minor, "parent_guardian")).resolves.toMatchObject({ docType: "client_recording" });
    await expect(sign(minor, "legal_representative")).resolves.toMatchObject({ docType: "client_recording" });
    const { rows } = await pool.query("select signer_relationship from client_consents order by created_at");
    expect(rows.map((r) => r.signer_relationship)).toEqual(["parent_guardian", "legal_representative"]);
  });

  it("still refuses 'self' the day before the 18th birthday, and accepts it on the day", async () => {
    await expect(sign(await clientBornOn(yearsAgo(18, 1)), "self")).rejects.toMatchObject({ reason: "minor_self" });
    await expect(sign(await clientBornOn(yearsAgo(18)), "self")).resolves.toMatchObject({ docType: "client_recording" });
  });

  it("accepts 'self' when no date of birth is on file", async () => {
    await expect(sign(await clientBornOn(null), "self")).resolves.toMatchObject({ docType: "client_recording" });
  });
});
