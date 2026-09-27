import { and, eq } from "drizzle-orm";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { db } from "../index";
import { claims } from "../schema";
import { NotOwnedError } from "@/server/errors";
import { tenantWhere } from "./scope";

// Returns the claim's client, so rows attached to it carry the same client_id.
export async function assertClaimOwned(ctx: ClinicianOnlyCtx, claimId: string): Promise<{ clientId: string }> {
  const [row] = await db.select({ clientId: claims.clientId }).from(claims).where(and(eq(claims.id, claimId), tenantWhere(claims, ctx)));
  if (!row) throw new NotOwnedError("Claim");
  return row;
}
