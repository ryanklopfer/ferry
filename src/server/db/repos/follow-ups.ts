import { and, asc, eq, inArray } from "drizzle-orm";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { type FollowUp, type FollowUpType, followUps } from "../schema";
import { assertClaimOwned } from "./owned";

export type FollowUpPatch = Partial<Pick<FollowUp, "status" | "draftSubject" | "draftBody" | "sentAt">>;

export const followUpsRepo = {
  forClaim(ctx: ClinicianOnlyCtx, claimId: string): Promise<FollowUp[]> {
    return db.select().from(followUps).where(and(eq(followUps.claimId, claimId), eq(followUps.userId, ctx.userId))).orderBy(asc(followUps.dueAt));
  },

  open(ctx: ClinicianOnlyCtx): Promise<FollowUp[]> {
    return db.select().from(followUps).where(and(eq(followUps.userId, ctx.userId), inArray(followUps.status, ["pending", "drafted"]))).orderBy(asc(followUps.dueAt));
  },

  async get(ctx: ClinicianOnlyCtx, id: string): Promise<FollowUp | null> {
    const [row] = await db.select().from(followUps).where(and(eq(followUps.id, id), eq(followUps.userId, ctx.userId)));
    return row ?? null;
  },

  async createMany(ctx: ClinicianOnlyCtx, claimId: string, items: { type: FollowUpType; dueAt: Date }[]): Promise<FollowUp[]> {
    await assertClaimOwned(ctx, claimId);
    if (!items.length) return [];
    return db.insert(followUps).values(items.map((i) => ({ ...i, id: newId("fup"), userId: ctx.userId, claimId }))).returning();
  },

  async update(ctx: ClinicianOnlyCtx, id: string, patch: FollowUpPatch): Promise<FollowUp | null> {
    const [row] = await db.update(followUps).set(patch).where(and(eq(followUps.id, id), eq(followUps.userId, ctx.userId))).returning();
    return row ?? null;
  },

  async dismiss(ctx: ClinicianOnlyCtx, ids: string[]): Promise<void> {
    if (!ids.length) return;
    await db.update(followUps).set({ status: "dismissed" }).where(and(inArray(followUps.id, ids), eq(followUps.userId, ctx.userId)));
  },
};
