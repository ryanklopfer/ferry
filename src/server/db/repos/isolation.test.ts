import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { createTestUser, resetDb } from "@/server/db/testing";
import { claimsRepo } from "./claims";
import { documentsRepo } from "./documents";
import { eventsRepo } from "./events";
import { followUpsRepo } from "./follow-ups";
import { plansRepo } from "./plans";
import { providersRepo } from "./providers";

const PLAN = { insurerName: "Cigna", memberId: "U4827193 01", subscriberName: "Samira Haddad", patientName: "Samira Haddad" };
const LINE = { serviceDate: "2026-08-04", cptCode: "90834", modifiers: [], description: "Psychotherapy, 45 min", units: 1, charge: 17500, diagnosisPointers: [1], placeOfService: "11" };

async function seed(ctx: ClinicianCtx) {
  const plan = await plansRepo.create(ctx, PLAN);
  const provider = await providersRepo.upsertByNpiOrName(ctx, { name: "Rachel Steinberg, LCSW", npi: "1999000023", taxId: "00-1000002", taxIdType: "EIN" });
  const claim = await claimsRepo.create(ctx, { planId: plan.id, billingProviderId: provider.id, billingProviderName: provider.name, diagnosisCodes: ["F33.1"], totalCharged: 17500 }, [LINE]);
  const document = await documentsRepo.create(ctx, { claimId: claim.id, kind: "superbill", storageKey: `${ctx.userId}/x.pdf`, mime: "application/pdf", bytes: 10, sha256: "abc" });
  const [followUp] = await followUpsRepo.createMany(ctx, claim.id, [{ type: "status_inquiry", dueAt: new Date("2026-10-01T00:00:00Z") }]);
  await eventsRepo.append(ctx, claim.id, "created", "Superbill uploaded");
  return { plan, provider, claim, document, followUp };
}

describe("tenant isolation", () => {
  let a: ClinicianCtx;
  let b: ClinicianCtx;
  let mine: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    await resetDb();
    a = await createTestUser("clinician", "a@example.test");
    b = await createTestUser("clinician", "b@example.test");
    mine = await seed(a);
  });
  afterAll(() => pool.end());

  it("shows another user nothing in any list", async () => {
    expect(await plansRepo.list(b)).toEqual([]);
    expect(await providersRepo.list(b)).toEqual([]);
    expect(await claimsRepo.list(b)).toEqual([]);
    expect(await followUpsRepo.open(b)).toEqual([]);
    expect(await claimsRepo.lines(b, mine.claim.id)).toEqual([]);
    expect(await documentsRepo.forClaim(b, mine.claim.id)).toEqual([]);
    expect(await followUpsRepo.forClaim(b, mine.claim.id)).toEqual([]);
    expect(await eventsRepo.forClaim(b, mine.claim.id)).toEqual([]);
  });

  it("finds nothing for another user by id", async () => {
    expect(await plansRepo.get(b, mine.plan.id)).toBeNull();
    expect(await providersRepo.get(b, mine.provider.id)).toBeNull();
    expect(await claimsRepo.get(b, mine.claim.id)).toBeNull();
    expect(await documentsRepo.get(b, mine.document.id)).toBeNull();
    expect(await followUpsRepo.get(b, mine.followUp.id)).toBeNull();
  });

  it("lets another user change or delete nothing", async () => {
    await claimsRepo.update(b, mine.claim.id, { status: "closed", billingProviderName: "Hijacked" });
    await claimsRepo.replaceLines(b, mine.claim.id, []);
    await followUpsRepo.update(b, mine.followUp.id, { status: "sent" });
    await followUpsRepo.dismiss(b, [mine.followUp.id]);
    await documentsRepo.remove(b, mine.document.id);
    await claimsRepo.remove(b, mine.claim.id);

    const claim = await claimsRepo.get(a, mine.claim.id);
    expect(claim?.status).toBe("draft");
    expect(claim?.billingProviderName).toBe("Rachel Steinberg, LCSW");
    expect(await claimsRepo.lines(a, mine.claim.id)).toHaveLength(1);
    expect((await followUpsRepo.get(a, mine.followUp.id))?.status).toBe("pending");
    expect(await documentsRepo.get(a, mine.document.id)).not.toBeNull();
  });

  it("refuses to attach a new row to something another user owns", async () => {
    await expect(claimsRepo.create(b, { planId: mine.plan.id }, [])).rejects.toThrow();
    await expect(documentsRepo.create(b, { claimId: mine.claim.id, kind: "eob", storageKey: "k", mime: "image/png", bytes: 1, sha256: "x" })).rejects.toThrow();
    await expect(followUpsRepo.createMany(b, mine.claim.id, [{ type: "appeal", dueAt: new Date() }])).rejects.toThrow();
    await expect(eventsRepo.append(b, mine.claim.id, "note", "hello")).rejects.toThrow();
    expect(await eventsRepo.forClaim(a, mine.claim.id)).toHaveLength(1);
  });

  it("keeps two users' providers with the same NPI apart", async () => {
    const theirs = await providersRepo.upsertByNpiOrName(b, { name: "Someone Else", npi: "1999000023" });
    expect(theirs.id).not.toBe(mine.provider.id);
    expect((await providersRepo.get(a, mine.provider.id))?.name).toBe("Rachel Steinberg, LCSW");
  });
});
