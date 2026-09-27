import type { ClientSelf } from "@/core/api/trips";
import { clientCtxFor } from "@/server/auth/client-ctx";
import type { SelfCtx } from "@/server/auth/ctx";
import { clientsRepo } from "@/server/db/repos/clients";
import { NotOwnedError } from "@/server/errors";

export async function getClientSelf(self: SelfCtx, membershipId: string): Promise<ClientSelf> {
  const ctx = await clientCtxFor(self, membershipId);
  const client = await clientsRepo.get(ctx, ctx.clientId);
  if (!client) throw new NotOwnedError("Client");
  return { membershipId, firstName: client.firstName };
}
