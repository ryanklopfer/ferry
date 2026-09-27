import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ClaimDetailSchema, ClaimListSchema } from "@/core/api/claims";
import type { ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { claimsRepo } from "@/server/db/repos/claims";
import { createTestUser, resetDb } from "@/server/db/testing";
import { getClaimDetail, listClaimSummaries } from "./api";
import { saveClaim } from "./claims";
import { createPlan } from "./plans";

describe("api v1 claim shapes", () => {
  let a: ClinicianCtx;
  let b: ClinicianCtx;
  let claimId: string;

  beforeEach(async () => {
    await resetDb();
    a = await createTestUser("clinician", "a@example.test");
    b = await createTestUser("clinician", "b@example.test");
    const plan = await createPlan(a, { insurerName: "Aetna", memberId: "W268417359", subscriberName: "Devon Price" });
    claimId = (await claimsRepo.create(a, { planId: plan.id }, [])).id;
    await saveClaim(a, claimId, {
      billingProvider: { name: "Harbor Light Therapy Group LLC", npi: "1999000064", taxId: "00-1000006", taxIdType: "EIN", address: null, phone: null },
      renderingProvider: { name: "Sofia Marchetti", npi: "1999000163", credential: "LMHC", license: null },
      placeOfService: "11",
      diagnosisCodes: ["F43.23"],
      lines: [{ serviceDate: "2026-08-19", cptCode: "90837", modifiers: ["HO", "95"], description: "Psychotherapy, 60 min", units: 1, charge: 24000, diagnosisPointers: [1], placeOfService: "10" }],
      totalPaid: null,
    });
  });
  afterAll(() => pool.end());

  it("lists the caller's claims in the contract shape", async () => {
    const body = ClaimListSchema.parse(await listClaimSummaries(a));
    expect(body.claims).toHaveLength(1);
    expect(body.claims[0]).toMatchObject({ id: claimId, status: "draft", insurerName: "Aetna", totalChargedCents: 24000 });
  });

  it("returns the detail in the contract shape, with the full line model", async () => {
    const detail = ClaimDetailSchema.parse(await getClaimDetail(a, claimId));
    expect(detail.lines).toEqual([{ serviceDate: "2026-08-19", cptCode: "90837", modifiers: ["HO", "95"], description: "Psychotherapy, 60 min", units: 1, chargeCents: 24000, diagnosisPointers: [1], placeOfService: "10" }]);
    expect(detail.renderingProviderName).toBe("Sofia Marchetti");
    expect(detail.followUps.map((f) => f.type)).toEqual(["timely_filing_warning"]);
  });

  it("never carries the member ID or the Tax ID", async () => {
    const wire = JSON.stringify([await listClaimSummaries(a), await getClaimDetail(a, claimId)]);
    expect(wire).not.toContain("W268417359");
    expect(wire).not.toContain("00-1000006");
  });

  it("gives another user an empty list and no detail", async () => {
    expect(await listClaimSummaries(b)).toEqual({ claims: [] });
    expect(await getClaimDetail(b, claimId)).toBeNull();
  });
});
