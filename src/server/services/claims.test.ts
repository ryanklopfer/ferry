import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { claimsRepo } from "@/server/db/repos/claims";
import { clientsRepo } from "@/server/db/repos/clients";
import { NotOwnedError } from "@/server/errors";
import { createTestUser, resetDb } from "@/server/db/testing";
import { type ClaimInput, closeClaim, deleteClaim, getClaim, listClaims, markSubmitted, saveClaim } from "./claims";
import { createPlan } from "./plans";

const DAY = 86_400_000;

const input = (over: Partial<ClaimInput> = {}): ClaimInput => ({
  billingProvider: { name: "Harbor Light Therapy Group LLC", npi: "1999000064", taxId: "00-1000006", taxIdType: "EIN", address: "26 Court St Suite 1200, Brooklyn, NY 11201", phone: "(718) 555-0155" },
  renderingProvider: { name: "Sofia Marchetti", npi: "1999000163", credential: "LMHC", license: null },
  placeOfService: "11",
  diagnosisCodes: ["F43.23", "F41.1"],
  lines: [
    { serviceDate: "2026-08-05", cptCode: "90791", modifiers: ["HO"], description: "Psychiatric diagnostic evaluation", units: 1, charge: 30000, diagnosisPointers: [1], placeOfService: null },
    { serviceDate: "2026-08-19", cptCode: "90837", modifiers: ["HO", "95"], description: "Psychotherapy, 60 min (telehealth)", units: 1, charge: 24000, diagnosisPointers: [1, 2], placeOfService: "10" },
  ],
  totalPaid: null,
  ...over,
});

describe("claims service", () => {
  let a: ClinicianCtx;
  let b: ClinicianCtx;
  let planId: string;
  // Claims come from approved notes from N9 on; until then a test starts from an empty draft.
  const draft = (ctx: ClinicianCtx) => claimsRepo.create(ctx, { planId }, []);

  beforeEach(async () => {
    await resetDb();
    a = await createTestUser("clinician", "a@example.test");
    b = await createTestUser("clinician", "b@example.test");
    const client = await clientsRepo.create(a, { firstName: "Devon", lastName: "Price", dob: null, email: null, phone: null });
    planId = (await createPlan(a, client.id, { insurerName: "Aetna", memberId: "W268417359", subscriberName: "Devon Price" })).id;
  });
  afterAll(() => pool.end());

  it("saves lines, totals, the as-filed billing and rendering snapshot, and schedules the timely-filing warning", async () => {
    const claim = await draft(a);
    await saveClaim(a, claim.id, input());
    const view = (await getClaim(a, claim.id))!;
    expect(view.lines.map((l) => [l.cptCode, l.modifiers, l.diagnosisPointers, l.placeOfService])).toEqual([
      ["90791", ["HO"], [1], "11"],
      ["90837", ["HO", "95"], [1, 2], "10"],
    ]);
    expect(view.claim.totalCharged).toBe(54000);
    expect(view.claim.totalPaid).toBe(54000);
    expect(view.claim.serviceDateStart).toBe("2026-08-05");
    expect(view.claim.serviceDateEnd).toBe("2026-08-19");
    expect(view.claim).toMatchObject({ billingProviderNpi: "1999000064", billingProviderTaxIdLast4: "0006", renderingProviderName: "Sofia Marchetti", renderingProviderNpi: "1999000163" });
    expect(view.followUps.filter((f) => f.status === "pending").map((f) => f.type)).toEqual(["timely_filing_warning"]);
    expect(view.deadlines.timelyFiling?.toISOString().slice(0, 10)).toBe("2027-02-01");
  });

  it("replaces the pending filing warning when the date of service moves, instead of adding a second", async () => {
    const claim = await draft(a);
    await saveClaim(a, claim.id, input());
    const moved = input();
    moved.lines[0].serviceDate = "2026-07-01";
    await saveClaim(a, claim.id, moved);
    const open = (await getClaim(a, claim.id))!.followUps.filter((f) => f.status === "pending");
    expect(open.map((f) => f.type)).toEqual(["timely_filing_warning"]);
    expect(open[0].dueAt.toISOString().slice(0, 10)).toBe("2026-11-28");
  });

  it("rejects a pointer to a diagnosis that is not listed", async () => {
    const claim = await draft(a);
    const bad = input();
    bad.lines[0].diagnosisPointers = [3];
    await expect(saveClaim(a, claim.id, bad)).rejects.toThrow(/diagnosis/i);
  });

  it("rejects more than four modifiers and malformed codes", async () => {
    const claim = await draft(a);
    const tooMany = input();
    tooMany.lines[0].modifiers = ["HO", "95", "59", "GT", "XE"];
    await expect(saveClaim(a, claim.id, tooMany)).rejects.toThrow();
    const badCpt = input();
    badCpt.lines[0].cptCode = "9083";
    await expect(saveClaim(a, claim.id, badCpt)).rejects.toThrow();
  });

  it("schedules inquiry, escalation and regulator notice on submit and retires the warning", async () => {
    const claim = await draft(a);
    await saveClaim(a, claim.id, input());
    const submittedAt = new Date("2026-09-17T16:00:00Z");
    await markSubmitted(a, claim.id, { submittedAt, channel: "portal", confirmationNumber: null, note: null });
    const view = (await getClaim(a, claim.id))!;
    expect(view.claim.status).toBe("submitted");
    const open = view.followUps.filter((f) => f.status === "pending");
    expect(open.map((f) => [f.type, Math.round((f.dueAt.getTime() - submittedAt.getTime()) / DAY)])).toEqual([
      ["status_inquiry", 14],
      ["escalation", 30],
      ["regulator_escalation", 45],
    ]);
    expect(view.followUps.find((f) => f.type === "timely_filing_warning")?.status).toBe("dismissed");
    expect(view.events.map((e) => e.type)).toContain("status:submitted");
  });

  it("gives another user nothing and lets them change nothing", async () => {
    const claim = await draft(a);
    await saveClaim(a, claim.id, input());

    expect(await getClaim(b, claim.id)).toBeNull();
    expect((await listClaims(b)).rows).toEqual([]);
    await expect(saveClaim(b, claim.id, input({ diagnosisCodes: ["Z00.00"] }))).rejects.toBeInstanceOf(NotOwnedError);
    await expect(markSubmitted(b, claim.id, { submittedAt: new Date(), channel: "fax", confirmationNumber: null, note: null })).rejects.toBeInstanceOf(NotOwnedError);
    await expect(closeClaim(b, claim.id, { note: null })).rejects.toBeInstanceOf(NotOwnedError);
    await deleteClaim(b, claim.id);

    const view = (await getClaim(a, claim.id))!;
    expect(view.claim.status).toBe("draft");
    expect(view.claim.diagnosisCodes).toEqual(["F43.23", "F41.1"]);
  });

  it("deletes the claim for its owner", async () => {
    const claim = await draft(a);
    await deleteClaim(a, claim.id);
    expect(await getClaim(a, claim.id)).toBeNull();
  });
});
