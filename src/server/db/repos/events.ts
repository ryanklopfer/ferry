import { and, desc, eq } from "drizzle-orm";
import type { ClinicianOnlyCtx, Ctx } from "@/server/auth/ctx";
import { keyringFor } from "@/server/crypto/tenant-keys";
import { db } from "../index";
import { decodeRows, encodeRow } from "../codec";
import { newId } from "../ids";
import { type Event, events } from "../schema";
import { assertClaimOwned } from "./owned";
import { assertNotClient, tenantWhere } from "./scope";

export const eventsRepo = {
  async forClaim(ctx: Ctx, claimId: string): Promise<Event[]> {
    const ring = await keyringFor(ctx);
    return decodeRows(events, ring, await db.select().from(events).where(and(eq(events.claimId, claimId), tenantWhere(events, ctx))).orderBy(desc(events.createdAt), desc(events.id)));
  },

  async append(ctx: ClinicianOnlyCtx, claimId: string, type: string, note?: string): Promise<void> {
    assertNotClient(ctx);
    const { clientId } = await assertClaimOwned(ctx, claimId);
    const ring = await keyringFor(ctx);
    await db.insert(events).values(encodeRow(events, ring, { id: newId("evt"), userId: ctx.userId, clientId, claimId, type, note }, { insert: true }));
  },
};
