import { membershipsRepo } from "@/server/db/repos/memberships";
import { NotOwnedError } from "@/server/errors";
import type { ClientCtx, SelfCtx } from "./ctx";

// The only way to build a ClientCtx (architecture §6 rule 3). Every failure is the same NotOwnedError, so a
// forged, revoked or someone else's membership is indistinguishable from a missing one (a 404).
export async function clientCtxFor(self: SelfCtx, membershipId: string): Promise<ClientCtx> {
  if (self.scope !== "self") throw new NotOwnedError("Membership");
  const m = await membershipsRepo.binding(self, membershipId);
  const ok = m && m.status === "active" && m.client.userId === m.clinicianUserId && m.client.clientUserId === self.userId && m.client.archivedAt === null;
  if (!ok) throw new NotOwnedError("Membership");
  return { scope: "client", userId: m.clinicianUserId, clientId: m.clientId, actorId: self.userId };
}
