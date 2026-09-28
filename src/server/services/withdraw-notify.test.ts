import { Client } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { clientCtxFor } from "@/server/auth/client-ctx";
import type { ClientCtx, ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { databaseUrl } from "@/server/db/env";
import { clientsRepo } from "@/server/db/repos/clients";
import { bindClientUser, createTestUser, resetDb } from "@/server/db/testing";
import { liveText } from "@/server/legal";
import { type ConsentWithdrawn, onConsentWithdrawn, recordConsent, withdrawConsent } from "./consents";

const settle = () => new Promise((r) => setTimeout(r, 150));

describe("withdrawing a client consent", () => {
  let listener: Client;
  let heard: string[];
  let hooked: ConsentWithdrawn[];
  let off: () => void;
  let x: ClinicianCtx;
  let k: ClientCtx;

  beforeEach(async () => {
    await resetDb();
    x = await createTestUser("clinician");
    const client = await clientsRepo.create(x, { firstName: "Priya", lastName: "Raman", dob: "1988-06-14", email: "priya.raman@example.test", phone: "555-010-3321" });
    const self = await createTestUser("client");
    k = await clientCtxFor(self, await bindClientUser(x, client.id, self));
    for (const docType of ["client_filing", "client_recording"] as const) {
      await recordConsent(k, { docType, typedName: "Priya Raman", shownHash: (await liveText(docType)).hash, signerRelationship: "self", ip: "203.0.113.5", userAgent: "vitest" });
    }
    await recordConsent(x, { docType: "npi_filing_authorization", typedName: "Rachel Steinberg", shownHash: (await liveText("npi_filing_authorization")).hash, ip: null, userAgent: null });

    heard = [];
    hooked = [];
    listener = new Client({ connectionString: databaseUrl() });
    await listener.connect();
    listener.on("notification", (n) => n.channel === "consent_withdrawn" && heard.push(n.payload ?? ""));
    await listener.query("LISTEN consent_withdrawn");
    off = onConsentWithdrawn((e) => void hooked.push(e));
  });
  afterEach(async () => {
    off();
    await listener.end();
  });
  afterAll(() => pool.end());

  it("emits one consent_withdrawn notification carrying ids only", async () => {
    expect(await withdrawConsent(k, "client_recording")).toBe(true);
    await settle();
    expect(heard).toHaveLength(1);
    const payload = JSON.parse(heard[0]);
    expect(payload).toEqual({ tenant: x.userId, clientId: k.clientId, docType: "client_recording" });
    for (const secret of ["Priya", "Raman", "priya.raman", "555-010", "1988", "203.0.113"]) expect(heard[0]).not.toContain(secret);
    expect(hooked).toEqual([payload]);
  });

  it("emits nothing when there was nothing to withdraw, or for a clinician's own consent", async () => {
    await withdrawConsent(k, "client_filing");
    expect(await withdrawConsent(k, "client_filing")).toBe(false);
    expect(await withdrawConsent(x, "npi_filing_authorization")).toBe(true);
    await settle();
    expect(heard.map((p) => JSON.parse(p).docType)).toEqual(["client_filing"]);
    expect(hooked).toHaveLength(1);
  });
});
