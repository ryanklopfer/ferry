import { eq, sql } from "drizzle-orm";
import { db } from "../index";
import { claims, users } from "../schema";

// The only ctx-less lookups (architecture §6 rule 8): each returns ids, never row content.
export const resolvers = {
  async userIdByEmail(email: string): Promise<string | null> {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()));
    return row?.id ?? null;
  },

  // The 837P patient control number (CLM01) is the claim id until S8 fixes its format. Webhooks and 277 handlers
  // turn it into a tenant for systemCtx.
  async claimByPatientControlNumber(pcn: string): Promise<{ tenant: string; claimId: string } | null> {
    const [row] = await db.select({ tenant: claims.userId, claimId: claims.id }).from(claims).where(eq(claims.id, pcn));
    return row ?? null;
  },
};
