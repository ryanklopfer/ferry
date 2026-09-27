import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/server/db";
import { databaseUrl } from "@/server/db/env";
import { migrateDb } from "@/server/db/migrate";
import { claimsRepo } from "@/server/db/repos/claims";
import { plansRepo } from "@/server/db/repos/plans";
import { createTestUser, resetDb } from "@/server/db/testing";

const PLAN = { insurerName: "Cigna", memberId: "U1", subscriberName: "Jordan Ellis", patientName: "Jordan Ellis" };

describe("postgres round trip", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("applies column defaults on insert", async () => {
    const ctx = await createTestUser("clinician", "defaults@example.test");
    const plan = await plansRepo.create(ctx, PLAN);
    expect(plan.id).toMatch(/^pln_/);
    expect(plan.timelyFilingDays).toBe(180);
    expect(plan.preferredChannel).toBe("portal");
    expect(Date.now() - plan.createdAt.getTime()).toBeLessThan(60_000);
    const claim = await claimsRepo.create(ctx, { planId: plan.id }, []);
    expect(claim.status).toBe("draft");
    expect(claim.placeOfService).toBe("11");
    expect(claim.diagnosisCodes).toEqual([]);
  });

  it("stores diagnosis codes as JSON and reads them back as an array", async () => {
    const ctx = await createTestUser("clinician", "json@example.test");
    const plan = await plansRepo.create(ctx, PLAN);
    const claim = await claimsRepo.create(ctx, { planId: plan.id, diagnosisCodes: ["F41.1", "F33.1"], totalCharged: 22500 }, []);
    expect((await claimsRepo.get(ctx, claim.id))?.diagnosisCodes).toEqual(["F41.1", "F33.1"]);
  });

  it("keeps a date of service as the calendar day it was given", async () => {
    const ctx = await createTestUser("clinician", "dates@example.test");
    const plan = await plansRepo.create(ctx, { ...PLAN, subscriberDob: "1989-03-14" });
    expect(plan.subscriberDob).toBe("1989-03-14");
    const claim = await claimsRepo.create(ctx, { planId: plan.id, serviceDateStart: "2026-12-31" }, []);
    expect((await claimsRepo.get(ctx, claim.id))?.serviceDateStart).toBe("2026-12-31");
  });

  it("is emptied by resetDb, users included", async () => {
    const ctx = await createTestUser("clinician", "reset@example.test");
    await plansRepo.create(ctx, PLAN);
    await resetDb();
    const { rows } = await pool.query("select (select count(*) from plans)::int + (select count(*) from users)::int as n");
    expect(rows[0].n).toBe(0);
  });

  it("can be migrated a second time without error", async () => {
    await expect(migrateDb(databaseUrl())).resolves.toBeUndefined();
  });
});
