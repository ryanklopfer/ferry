import { ClientSelfSchema } from "@/core/api/trips";
import { getClient } from "@/server/auth/ctx";
import { NotOwnedError } from "@/server/errors";
import { getClientSelf } from "@/server/services/trips";
import { apiOk, denied } from "../../respond";

export async function GET(_req: Request, { params }: RouteContext<"/api/v1/memberships/[id]">) {
  const self = await getClient();
  if (typeof self === "number") return denied(self);
  const { id } = await params;
  try {
    return apiOk(ClientSelfSchema, await getClientSelf(self, id));
  } catch (e) {
    if (e instanceof NotOwnedError) return denied(404);
    throw e;
  }
}
