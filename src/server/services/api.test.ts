import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listRoute } from "@/app/api/v1/claims/route";
import { ClaimDetailSchema, ClaimListSchema } from "@/core/api/claims";
import type { ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { claimsRepo } from "@/server/db/repos/claims";
import { clientsRepo } from "@/server/db/repos/clients";
import { bindClientUser, createTestUser, resetDb, signedInHeaders } from "@/server/db/testing";
import { getClaimDetail, listClaimSummaries } from "./api";
import { saveClaim } from "./claims";
import { createPlan } from "./plans";

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));

const newClient = (ctx: ClinicianCtx, firstName: string) => clientsRepo.create(ctx, { firstName, lastName: "Price", dob: null, email: null, phone: null });

describe("api v1 claim shapes", () => {
  let a: ClinicianCtx;
  let b: ClinicianCtx;
  let claimId: string;

  beforeEach(async () => {
    await resetDb();
    a = await createTestUser("clinician", "a@example.test");
    b = await createTestUser("clinician", "b@example.test");
    request.headers = new Headers();
    const plan = await createPlan(a, (await newClient(a, "Devon")).id, { insurerName: "Aetna", memberId: "W268417359", subscriberName: "Devon Price" });
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

  describe("GET /api/v1/claims", () => {
    it("lists only the caller's tenant", async () => {
      const theirs = await createPlan(b, (await newClient(b, "Erin")).id, { insurerName: "Cigna", memberId: "U1", subscriberName: "Erin Price" });
      const theirClaim = (await claimsRepo.create(b, { planId: theirs.id }, [])).id;

      request.headers = await signedInHeaders("a@example.test");
      const mine = ClaimListSchema.parse(await (await listRoute()).json());
      expect(mine.claims.map((c) => c.id)).toEqual([claimId]);

      request.headers = await signedInHeaders("b@example.test");
      const others = ClaimListSchema.parse(await (await listRoute()).json());
      expect(others.claims.map((c) => c.id)).toEqual([theirClaim]);
    });

    it("returns 404 for a client session, even one bound to the tenant's client", async () => {
      const u = await createTestUser("client", "u@example.test");
      const [client] = await clientsRepo.list(a);
      await bindClientUser(a, client.id, u);
      request.headers = await signedInHeaders("u@example.test");
      const response = await listRoute();
      expect(response.status).toBe(404);
      expect(JSON.stringify(await response.json())).not.toContain(claimId);
    });
  });
});
