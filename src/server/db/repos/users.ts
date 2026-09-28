import { and, eq } from "drizzle-orm";
import type { Role } from "@/server/auth/ctx";
import { newTenantKey } from "@/server/crypto/tenant-keys";
import { db } from "../index";
import { tenantKeys, users } from "../schema";

// Better Auth's users table has no tenant, so this takes no ctx. Lint (ferry/privileged-imports) limits it to services/roles.ts and services/invites.ts.
export const usersRepo = {
  // Compare-and-set: the role changes only while it is still `from`. Returns the role held afterwards, or null when there is no such user.
  // A user becomes a clinician tenant and gets their tenant key in one transaction; keys are never made on first use.
  async changeRole(userId: string, from: Role, to: Role): Promise<string | null> {
    const key = to === "clinician" ? await newTenantKey(userId) : null;
    const changed = await db.transaction(async (tx) => {
      const [row] = await tx.update(users).set({ role: to }).where(and(eq(users.id, userId), eq(users.role, from))).returning({ role: users.role });
      if (row && key) await tx.insert(tenantKeys).values({ ...key, userId });
      return row;
    });
    if (changed) return changed.role;
    const [current] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    return current?.role ?? null;
  },
};
