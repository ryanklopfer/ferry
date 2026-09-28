import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentConsent, docHash } from "@/core/legal";
import type { ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { createTestUser, resetDb } from "@/server/db/testing";
import { liveText } from "@/server/legal";
import { tempLegalDir } from "@/test-support/legal-dir";
import { consentStatus, recordConsent } from "./consents";

const IP = "203.0.113.77";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) Ferry-Consent-Test/1.0";

describe("a consent record", () => {
  let legal: ReturnType<typeof tempLegalDir>;
  let x: ClinicianCtx;

  beforeEach(async () => {
    await resetDb();
    legal = tempLegalDir();
    x = await createTestUser("clinician");
  });
  afterEach(() => legal.restore());
  afterAll(() => pool.end());

  it("stores the text's version and sha256; after the text changes it reads stale and the row is unchanged", async () => {
    const source = fs.readFileSync(path.join(legal.dir, "npi-filing-authorization.md"), "utf8");
    const sha = createHash("sha256").update(source).digest("hex");
    const { hash } = await liveText("npi_filing_authorization");
    expect(hash).toBe(sha);

    await recordConsent(x, { docType: "npi_filing_authorization", typedName: "Rachel Steinberg", shownHash: hash, ip: IP, userAgent: UA });
    const before = await pool.query("select * from clinician_consents where user_id = $1", [x.userId]);
    expect(before.rows).toHaveLength(1);
    expect(before.rows[0]).toMatchObject({ doc_type: "npi_filing_authorization", version: "0.0.0", content_hash: sha, withdrawn_at: null });
    expect((await consentStatus(x)).npi_filing_authorization).toBe("current");

    legal.bump("npi_filing_authorization");
    const bumped = await liveText("npi_filing_authorization");
    expect(bumped.doc.version).toBe("0.0.1");
    expect(bumped.hash).not.toBe(sha);
    expect((await consentStatus(x)).npi_filing_authorization).toBe("stale");
    const record = { docType: before.rows[0].doc_type, contentHash: before.rows[0].content_hash, createdAt: before.rows[0].created_at, withdrawnAt: null };
    expect(currentConsent([record], "npi_filing_authorization", bumped.hash)).toBe("stale");
    expect(currentConsent([record], "npi_filing_authorization", docHash(source))).toBe("current");

    const after = await pool.query("select * from clinician_consents where user_id = $1", [x.userId]);
    expect(after.rows).toEqual(before.rows);
  });

  it("writes nothing about the signer's address or browser to the logs", async () => {
    const lines: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(" "))));
    const { hash } = await liveText("terms");
    await recordConsent(x, { docType: "terms", typedName: "Rachel Steinberg", shownHash: hash, ip: IP, userAgent: UA });
    for (const s of spies) s.mockRestore();
    const out = lines.join("\n");
    expect(out).toContain("consent.recorded");
    for (const secret of [IP, UA, "Ferry-Consent-Test", "Rachel"]) expect(out).not.toContain(secret);
  });
});
