import { and, eq } from "drizzle-orm";
import type { Role } from "@/server/auth/ctx";
import { db } from "../index";
import { users } from "../schema";

// Better Auth's users table has no tenant, so this takes no ctx. Lint (ferry/privileged-imports) limits it to services/roles.ts and services/invites.ts.
export const usersRepo = {
  // Compare-and-set: the role changes only while it is still `from`. Returns the role held afterwards, or null when there is no such user.
  async changeRole(userId: string, from: Role, to: Role): Promise<string | null> {
    const [changed] = await db.update(users).set({ role: to }).where(and(eq(users.id, userId), eq(users.role, from))).returning({ role: users.role });
    if (changed) return changed.role;
    const [current] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    return current?.role ?? null;
  },
};
