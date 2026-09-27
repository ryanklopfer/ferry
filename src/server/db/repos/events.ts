import { and, desc, eq } from "drizzle-orm";
import type { ClinicianOnlyCtx, Ctx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { type Event, events } from "../schema";
import { assertClaimOwned } from "./owned";
import { assertNotClient, tenantWhere } from "./scope";

export const eventsRepo = {
  forClaim(ctx: Ctx, claimId: string): Promise<Event[]> {
    return db.select().from(events).where(and(eq(events.claimId, claimId), tenantWhere(events, ctx))).orderBy(desc(events.createdAt), desc(events.id));
  },

  async append(ctx: ClinicianOnlyCtx, claimId: string, type: string, note?: string): Promise<void> {
    assertNotClient(ctx);
    const { clientId } = await assertClaimOwned(ctx, claimId);
    await db.insert(events).values({ id: newId("evt"), userId: ctx.userId, clientId, claimId, type, note });
  },
};
