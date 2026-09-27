import { eq, sql } from "drizzle-orm";
import { db } from "../index";
import { users } from "../schema";

// The only ctx-less lookups (architecture §6): each returns ids, never row content.
export const resolvers = {
  async userIdByEmail(email: string): Promise<string | null> {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()));
    return row?.id ?? null;
  },
};
