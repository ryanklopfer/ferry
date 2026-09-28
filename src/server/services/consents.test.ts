import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ConsentDocType, isClientDocType } from "@/core/legal";
import { clientCtxFor } from "@/server/auth/client-ctx";
import type { ClientCtx, ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { clientConsentsRepo, clinicianConsentsRepo } from "@/server/db/repos/consents";
import { clientsRepo } from "@/server/db/repos/clients";
import { ScopeRefused } from "@/server/db/repos/scope";
import { bindClientUser, createTestUser, resetDb } from "@/server/db/testing";
import { ConsentMissing, ConsentRefused, ConsentStale } from "@/server/errors";
import { liveText } from "@/server/legal";
import { tempLegalDir } from "@/test-support/legal-dir";
import { consentStatus, recordConsent, recordConsents, requireFilingConsent, requireRecordingConsent, staleConsents, withdrawConsent } from "./consents";

async function sign(ctx: ClinicianCtx | ClientCtx, docType: ConsentDocType) {
  const { hash } = await liveText(docType);
  return recordConsent(ctx, { docType, typedName: "Synthetic Signer", shownHash: hash, signerRelationship: isClientDocType(docType) ? "self" : undefined, ip: "203.0.113.9", userAgent: "vitest" });
}

describe("consents", () => {
  let legal: ReturnType<typeof tempLegalDir>;
  let x: ClinicianCtx;
  let y: ClinicianCtx;
  let k: ClientCtx;
  let clientId: string;

  beforeEach(async () => {
    await resetDb();
    legal = tempLegalDir();
    x = await createTestUser("clinician");
    y = await createTestUser("clinician");
    const client = await clientsRepo.create(x, { firstName: "Ana", lastName: "Ortiz", dob: "1990-04-02", email: "ana@example.test", phone: null });
    clientId = client.id;
    const self = await createTestUser("client");
    k = await clientCtxFor(self, await bindClientUser(x, client.id, self));
  });
  afterEach(() => legal.restore());
  afterAll(() => pool.end());

  it("keeps recording and filing consents as separate rows; withdrawing one leaves the other current", async () => {
    await sign(k, "client_recording");
    await sign(k, "client_filing");
    const { rows } = await pool.query<{ doc_type: string; client_id: string; actor_user_id: string; withdrawn_at: Date | null }>("select doc_type, client_id, actor_user_id, withdrawn_at from client_consents where user_id = $1 order by doc_type", [x.userId]);
    expect(rows.map((r) => r.doc_type)).toEqual(["client_filing", "client_recording"]);
    expect(rows.every((r) => r.client_id === clientId && r.actor_user_id === k.actorId)).toBe(true);

    expect(await withdrawConsent(k, "client_recording")).toBe(true);
    const after = await pool.query<{ doc_type: string; withdrawn_at: Date | null }>("select doc_type, withdrawn_at from client_consents where user_id = $1 order by doc_type", [x.userId]);
    expect(after.rows[0]).toMatchObject({ doc_type: "client_filing", withdrawn_at: null });
    expect(after.rows[1].withdrawn_at).toBeInstanceOf(Date);
    expect(await consentStatus(k)).toEqual({ client_filing: "current", client_recording: "none" });
  });

  it("refuses a client recording a clinician doc type, and a clinician recording a client one", async () => {
    for (const t of ["terms", "privacy", "baa", "npi_filing_authorization"] as const) {
      await expect(sign(k, t), t).rejects.toMatchObject({ name: "ConsentRefused", reason: "wrong_party" });
    }
    for (const t of ["client_filing", "client_recording"] as const) {
      await expect(sign(x, t), t).rejects.toBeInstanceOf(ConsentRefused);
    }
    await expect(withdrawConsent(k, "baa")).rejects.toBeInstanceOf(ConsentRefused);
    await expect(withdrawConsent(x, "client_filing")).rejects.toBeInstanceOf(ConsentRefused);
    expect((await pool.query("select 1 from clinician_consents union all select 1 from client_consents")).rows).toEqual([]);
  });

  it("keeps clinician consents from a client context, even past the type checker", async () => {
    await sign(x, "baa");
    await expect(clinicianConsentsRepo.list(k as unknown as ClinicianCtx)).rejects.toBeInstanceOf(ScopeRefused);
    expect(await clinicianConsentsRepo.list(y)).toEqual([]);
    expect(await clientConsentsRepo.listFor(y, clientId)).toEqual([]);
  });

  it("requireFilingConsent needs both halves; requireRecordingConsent fails as soon as it is withdrawn", async () => {
    await expect(requireFilingConsent(x, clientId)).rejects.toBeInstanceOf(ConsentMissing);
    await sign(k, "client_filing");
    await expect(requireFilingConsent(x, clientId)).rejects.toMatchObject({ name: "ConsentMissing", docTypes: ["npi_filing_authorization"] });
    await withdrawConsent(k, "client_filing");
    await sign(x, "npi_filing_authorization");
    await expect(requireFilingConsent(x, clientId)).rejects.toMatchObject({ name: "ConsentMissing", docTypes: ["client_filing"] });
    await sign(k, "client_filing");
    await expect(requireFilingConsent(x, clientId)).resolves.toBeUndefined();
    await expect(requireFilingConsent(y, clientId)).rejects.toBeInstanceOf(ConsentMissing);

    await expect(requireRecordingConsent(x, clientId)).rejects.toBeInstanceOf(ConsentMissing);
    await sign(k, "client_recording");
    await expect(requireRecordingConsent(x, clientId)).resolves.toBeUndefined();
    await withdrawConsent(k, "client_recording");
    await expect(requireRecordingConsent(x, clientId)).rejects.toMatchObject({ name: "ConsentMissing", docTypes: ["client_recording"] });
    await expect(requireFilingConsent(x, clientId)).resolves.toBeUndefined();
  });

  it("after a legal text's hash changes, both gates throw ConsentStale until re-consent, then pass", async () => {
    for (const t of ["client_filing", "client_recording"] as const) await sign(k, t);
    await sign(x, "npi_filing_authorization");
    await requireFilingConsent(x, clientId);
    await requireRecordingConsent(x, clientId);

    legal.bump("npi_filing_authorization");
    await expect(requireFilingConsent(x, clientId)).rejects.toMatchObject({ name: "ConsentStale", docTypes: ["npi_filing_authorization"] });
    expect(await staleConsents(x)).toEqual(["npi_filing_authorization"]);
    await sign(x, "npi_filing_authorization");
    await expect(requireFilingConsent(x, clientId)).resolves.toBeUndefined();
    expect(await staleConsents(x)).toEqual([]);

    legal.bump("client_filing");
    legal.bump("client_recording");
    await expect(requireFilingConsent(x, clientId)).rejects.toMatchObject({ name: "ConsentStale", docTypes: ["client_filing"] });
    await expect(requireRecordingConsent(x, clientId)).rejects.toBeInstanceOf(ConsentStale);
    expect(await staleConsents(k)).toEqual(["client_filing", "client_recording"]);
    await sign(k, "client_filing");
    await sign(k, "client_recording");
    await expect(requireFilingConsent(x, clientId)).resolves.toBeUndefined();
    await expect(requireRecordingConsent(x, clientId)).resolves.toBeUndefined();
    expect((await pool.query("select 1 from client_consents where user_id = $1", [x.userId])).rows).toHaveLength(4);
  });

  it("refuses a consent to a text that changed after it was shown", async () => {
    const { hash } = await liveText("client_filing");
    legal.bump("client_filing");
    await expect(recordConsent(k, { docType: "client_filing", typedName: "Ana Ortiz", shownHash: hash, signerRelationship: "self", ip: null, userAgent: null })).rejects.toMatchObject({ reason: "text_changed" });
    await expect(recordConsent(k, { docType: "client_filing", typedName: "  ", shownHash: (await liveText("client_filing")).hash, signerRelationship: "self", ip: null, userAgent: null })).rejects.toMatchObject({ reason: "no_name" });
    await expect(recordConsent(k, { docType: "client_filing", typedName: "Ana Ortiz", shownHash: (await liveText("client_filing")).hash, ip: null, userAgent: null })).rejects.toMatchObject({ reason: "no_signer" });
  });

  it("records texts signed together all at once, or none of them when any is refused", async () => {
    const input = async (docType: "client_filing" | "client_recording") => ({ docType, typedName: "Ana Ortiz", shownHash: (await liveText(docType)).hash, signerRelationship: "self" as const, ip: null, userAgent: null });
    const [filing, recording] = [await input("client_filing"), await input("client_recording")];
    legal.bump("client_recording");
    await expect(recordConsents(k, [filing, recording])).rejects.toMatchObject({ reason: "text_changed" });
    expect(await consentStatus(k)).toEqual({ client_filing: "none", client_recording: "none" });

    const recorded = await recordConsents(k, [filing, await input("client_recording")]);
    expect(recorded.map((r) => r.docType)).toEqual(["client_filing", "client_recording"]);
    expect(await consentStatus(k)).toEqual({ client_filing: "current", client_recording: "current" });

    const [terms, baa] = await Promise.all((["terms", "baa"] as const).map(async (docType) => ({ docType, typedName: "Rachel Steinberg", shownHash: (await liveText(docType)).hash, ip: null, userAgent: null })));
    await expect(recordConsents(x, [terms, { ...baa, typedName: " " }])).rejects.toMatchObject({ reason: "no_name" });
    expect(await consentStatus(x)).toMatchObject({ terms: "none", baa: "none" });
  });
});
