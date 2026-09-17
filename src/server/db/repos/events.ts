import { and, desc, eq } from "drizzle-orm";
import type { Ctx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { type Event, events } from "../schema";
import { assertClaimOwned } from "./owned";

export const eventsRepo = {
  forClaim(ctx: Ctx, claimId: string): Promise<Event[]> {
    return db.select().from(events).where(and(eq(events.claimId, claimId), eq(events.userId, ctx.userId))).orderBy(desc(events.createdAt), desc(events.id));
  },

  async append(ctx: Ctx, claimId: string, type: string, note?: string): Promise<void> {
    await assertClaimOwned(ctx, claimId);
    await db.insert(events).values({ id: newId("evt"), userId: ctx.userId, claimId, type, note });
  },
};
