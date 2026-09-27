import type { Role } from "@/server/auth/ctx";
import { resolvers } from "@/server/db/repos/resolvers";
import { usersRepo } from "@/server/db/repos/users";

export class RoleRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleRefused";
  }
}

// Roles never come from request input. Only Start free (N5), acceptInvite (N7a) and staff:grant call this; lint enforces it.
// One role per user at launch, so a role is only ever set on a pending user.
export async function setRoleOnServer(userId: string, role: Exclude<Role, "pending">): Promise<void> {
  const now = await usersRepo.changeRole(userId, "pending", role);
  if (now === role) return;
  if (now === null) throw new RoleRefused("No such user.");
  throw new RoleRefused(`That user is a ${now}. One role per user at launch: they need a separate email for this role.`);
}

export async function grantStaff(email: string): Promise<{ userId: string }> {
  const userId = await resolvers.userIdByEmail(email);
  if (!userId) throw new RoleRefused("No user has signed in with that email. They need to sign in once first.");
  await setRoleOnServer(userId, "staff");
  return { userId };
}
