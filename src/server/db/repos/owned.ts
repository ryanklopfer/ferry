import { and, eq } from "drizzle-orm";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { db } from "../index";
import { claims } from "../schema";
import { NotOwnedError } from "@/server/errors";

export async function assertClaimOwned(ctx: ClinicianOnlyCtx, claimId: string): Promise<void> {
  const [row] = await db.select({ id: claims.id }).from(claims).where(and(eq(claims.id, claimId), eq(claims.userId, ctx.userId)));
  if (!row) throw new NotOwnedError("Claim");
}
