import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import type { Role } from "./ctx";

export class RoleRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleRefused";
  }
}

// Roles never come from request input; only server paths (Start free, acceptInvite, staff:grant) call this.
export async function setRoleOnServer(userId: string, role: Role): Promise<boolean> {
  const updated = await db.update(users).set({ role }).where(eq(users.id, userId)).returning({ id: users.id });
  return updated.length > 0;
}

export async function grantStaff(email: string): Promise<{ userId: string }> {
  const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()));
  if (!user) throw new RoleRefused("No user has signed in with that email. They need to sign in once first.");
  if (user.role === "staff") return { userId: user.id };
  if (user.role !== "pending") throw new RoleRefused(`That user is a ${user.role}. One role per user at launch: staff need their own email.`);
  await setRoleOnServer(user.id, "staff");
  return { userId: user.id };
}
