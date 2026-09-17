import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool, schema } from "@/server/db";
import { databaseUrl } from "@/server/db/env";
import { migrateDb } from "@/server/db/migrate";
import { resetDb } from "@/server/db/testing";

const { plans, claims, lineItems } = schema;

const planValues = { insurerName: "Cigna", memberId: "U1", subscriberName: "Jordan Ellis", patientName: "Jordan Ellis" };

describe("postgres round trip", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("applies column defaults on insert", async () => {
    const [plan] = await db.insert(plans).values(planValues).returning();
    expect(plan.id).toBeGreaterThan(0);
    expect(plan.timelyFilingDays).toBe(180);
    expect(plan.preferredChannel).toBe("portal");
    expect(plan.createdAt).toBeGreaterThan(1_700_000_000);
  });

  it("stores diagnosis codes as JSON and reads them back as an array", async () => {
    const [plan] = await db.insert(plans).values(planValues).returning();
    const [claim] = await db.insert(claims).values({ planId: plan.id, diagnosisCodes: ["F41.1", "F33.1"], totalCharged: 22500 }).returning();
    expect(claim.status).toBe("draft");
    const found = await db.query.claims.findFirst({ where: eq(claims.id, claim.id) });
    expect(found?.diagnosisCodes).toEqual(["F41.1", "F33.1"]);
  });

  it("deletes line items when their claim is deleted", async () => {
    const [plan] = await db.insert(plans).values(planValues).returning();
    const [claim] = await db.insert(claims).values({ planId: plan.id }).returning();
    await db.insert(lineItems).values({ claimId: claim.id, cptCode: "90837", charge: 22500 });
    await db.delete(claims).where(eq(claims.id, claim.id));
    expect(await db.select().from(lineItems)).toHaveLength(0);
  });

  it("restarts ids after resetDb", async () => {
    const [first] = await db.insert(plans).values(planValues).returning();
    await resetDb();
    const [second] = await db.insert(plans).values(planValues).returning();
    expect(second.id).toBe(first.id);
  });

  it("can be migrated a second time without error", async () => {
    await expect(migrateDb(databaseUrl())).resolves.toBeUndefined();
  });
});
