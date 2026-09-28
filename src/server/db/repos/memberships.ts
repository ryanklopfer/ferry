import { and, eq } from "drizzle-orm";
import type { SelfCtx } from "@/server/auth/ctx";
import { db } from "../index";
import { type MembershipStatus, clientMemberships, clients } from "../schema";

export type MembershipBinding = {
  id: string;
  status: MembershipStatus;
  clinicianUserId: string;
  clientId: string;
  client: { userId: string; clientUserId: string | null; archivedAt: Date | null };
};

// A SelfCtx reads only its own memberships. Ids and flags only: clientCtxFor decides from them.
export const membershipsRepo = {
  async activeIds(self: SelfCtx): Promise<string[]> {
    const rows = await db.select({ id: clientMemberships.id }).from(clientMemberships).where(and(eq(clientMemberships.userId, self.userId), eq(clientMemberships.status, "active"))).orderBy(clientMemberships.createdAt);
    return rows.map((r) => r.id);
  },

  async binding(self: SelfCtx, membershipId: string): Promise<MembershipBinding | null> {
    const [row] = await db
      .select({
        id: clientMemberships.id,
        status: clientMemberships.status,
        clinicianUserId: clientMemberships.clinicianUserId,
        clientId: clientMemberships.clientId,
        client: { userId: clients.userId, clientUserId: clients.clientUserId, archivedAt: clients.archivedAt },
      })
      .from(clientMemberships)
      .innerJoin(clients, eq(clients.id, clientMemberships.clientId))
      .where(and(eq(clientMemberships.id, membershipId), eq(clientMemberships.userId, self.userId)));
    return row ?? null;
  },
};
