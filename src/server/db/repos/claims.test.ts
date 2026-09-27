import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { createTestUser, resetDb } from "@/server/db/testing";
import { claimsRepo } from "./claims";
import { eventsRepo } from "./events";
import { followUpsRepo } from "./follow-ups";
import { plansRepo } from "./plans";

const LINES = [
  { serviceDate: "2026-08-05", cptCode: "90791", modifiers: ["HO"], description: "Psychiatric diagnostic evaluation", units: 1, charge: 30000, diagnosisPointers: [1], placeOfService: "11" },
  { serviceDate: "2026-08-19", cptCode: "96137", modifiers: ["95", "59"], description: "Test admin and scoring, each addl 30 min", units: 3, charge: 45000, diagnosisPointers: [1, 2], placeOfService: "10" },
];

describe("claim line model", () => {
  let ctx: ClinicianCtx;
  let planId: string;

  beforeEach(async () => {
    await resetDb();
    ctx = await createTestUser("clinician", "lines@example.test");
    planId = (await plansRepo.create(ctx, { insurerName: "Aetna", memberId: "W268417359", subscriberName: "Devon Price", patientName: "Devon Price" })).id;
  });
  afterAll(() => pool.end());

  it("round-trips two lines with units, two modifiers and per-line pointers, in order", async () => {
    const claim = await claimsRepo.create(ctx, { planId, diagnosisCodes: ["F43.23", "F90.2"] }, LINES);
    const stored = await claimsRepo.lines(ctx, claim.id);
    expect(stored.map(({ serviceDate, cptCode, modifiers, description, units, charge, diagnosisPointers, placeOfService }) => ({ serviceDate, cptCode, modifiers, description, units, charge, diagnosisPointers, placeOfService }))).toEqual(LINES);
    expect(claim.id).toMatch(/^clm_/);
    expect(stored[0].id).toMatch(/^lin_/);
  });

  it("replaces lines as a set", async () => {
    const claim = await claimsRepo.create(ctx, { planId }, LINES);
    await claimsRepo.replaceLines(ctx, claim.id, [LINES[1]]);
    const stored = await claimsRepo.lines(ctx, claim.id);
    expect(stored.map((l) => l.cptCode)).toEqual(["96137"]);
  });

  it("is refused a fifth modifier by the database itself", async () => {
    await expect(claimsRepo.create(ctx, { planId }, [{ ...LINES[0], modifiers: ["95", "59", "HO", "GT", "XE"] }])).rejects.toThrow();
  });

  it("takes its lines, follow-ups and events with it when deleted", async () => {
    const claim = await claimsRepo.create(ctx, { planId }, LINES);
    await followUpsRepo.createMany(ctx, claim.id, [{ type: "appeal", dueAt: new Date() }]);
    await eventsRepo.append(ctx, claim.id, "created");
    await claimsRepo.remove(ctx, claim.id);
    const { rows } = await pool.query("select (select count(*) from claim_lines)::int + (select count(*) from follow_ups)::int + (select count(*) from events)::int as n");
    expect(rows[0].n).toBe(0);
  });

  it("stores timestamps as real dates", async () => {
    const claim = await claimsRepo.create(ctx, { planId }, []);
    expect(claim.createdAt).toBeInstanceOf(Date);
    const when = new Date("2026-09-17T15:00:00Z");
    await claimsRepo.update(ctx, claim.id, { submittedAt: when });
    expect((await claimsRepo.get(ctx, claim.id))?.submittedAt?.toISOString()).toBe(when.toISOString());
  });
});
