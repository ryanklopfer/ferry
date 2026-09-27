import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool, schema } from "@/server/db";
import { createTestUser, resetDb } from "@/server/db/testing";
import { RoleRefused, setRoleOnServer } from "./roles";

const roleOf = async (userId: string) => (await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)))[0]?.role;

describe("setRoleOnServer", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("gives a pending user a role", async () => {
    const { userId } = await createTestUser("pending");
    await setRoleOnServer(userId, "clinician");
    expect(await roleOf(userId)).toBe("clinician");
  });

  it("is a no-op when the user already holds that role", async () => {
    const { userId } = await createTestUser("client");
    await setRoleOnServer(userId, "client");
    expect(await roleOf(userId)).toBe("client");
  });

  it("never changes a role that is not pending", async () => {
    for (const [from, to] of [["clinician", "staff"], ["staff", "client"], ["client", "clinician"], ["clinician", "client"]] as const) {
      const { userId } = await createTestUser(from);
      await expect(setRoleOnServer(userId, to), `${from} -> ${to}`).rejects.toBeInstanceOf(RoleRefused);
      expect(await roleOf(userId)).toBe(from);
    }
  });

  it("refuses a user that does not exist", async () => {
    await expect(setRoleOnServer("usr_missing", "staff")).rejects.toBeInstanceOf(RoleRefused);
  });

  it("lets exactly one of two racing role changes win", async () => {
    for (let i = 0; i < 5; i++) {
      const { userId } = await createTestUser("pending");
      const results = await Promise.allSettled([setRoleOnServer(userId, "staff"), setRoleOnServer(userId, "clinician")]);
      const won = results.flatMap((r, n) => (r.status === "fulfilled" ? [n === 0 ? "staff" : "clinician"] : []));
      expect(won).toHaveLength(1);
      expect(await roleOf(userId)).toBe(won[0]);
    }
  });
});
