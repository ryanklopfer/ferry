import { and, asc, eq, inArray } from "drizzle-orm";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { keyringFor } from "./tenant-keys";
import { db } from "../index";
import { decodeRow, decodeRows, encodeRow } from "../codec";
import { newId } from "../ids";
import { type FollowUp, type FollowUpType, followUps } from "../schema";
import { assertClaimOwned } from "./owned";
import { assertNotClient, tenantWhere } from "./scope";

export type FollowUpPatch = Partial<Pick<FollowUp, "status" | "draftSubject" | "draftBody" | "sentAt">>;

export const followUpsRepo = {
  async forClaim(ctx: ClinicianOnlyCtx, claimId: string): Promise<FollowUp[]> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    return decodeRows(followUps, ring, await db.select().from(followUps).where(and(eq(followUps.claimId, claimId), tenantWhere(followUps, ctx))).orderBy(asc(followUps.dueAt)));
  },

  async open(ctx: ClinicianOnlyCtx): Promise<FollowUp[]> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    return decodeRows(followUps, ring, await db.select().from(followUps).where(and(tenantWhere(followUps, ctx), inArray(followUps.status, ["pending", "drafted"]))).orderBy(asc(followUps.dueAt)));
  },

  async get(ctx: ClinicianOnlyCtx, id: string): Promise<FollowUp | null> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    const [row] = await db.select().from(followUps).where(and(eq(followUps.id, id), tenantWhere(followUps, ctx)));
    return row ? decodeRow(followUps, ring, row) : null;
  },

  async createMany(ctx: ClinicianOnlyCtx, claimId: string, items: { type: FollowUpType; dueAt: Date }[]): Promise<FollowUp[]> {
    assertNotClient(ctx);
    await assertClaimOwned(ctx, claimId);
    if (!items.length) return [];
    const ring = await keyringFor(ctx);
    return decodeRows(followUps, ring, await db.insert(followUps).values(items.map((i) => encodeRow(followUps, ring, { ...i, id: newId("fup"), userId: ctx.userId, claimId }, { insert: true }))).returning());
  },

  async update(ctx: ClinicianOnlyCtx, id: string, patch: FollowUpPatch): Promise<FollowUp | null> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    const [row] = await db.update(followUps).set(encodeRow(followUps, ring, patch, { id })).where(and(eq(followUps.id, id), tenantWhere(followUps, ctx))).returning();
    return row ? decodeRow(followUps, ring, row) : null;
  },

  async dismiss(ctx: ClinicianOnlyCtx, ids: string[]): Promise<void> {
    assertNotClient(ctx);
    if (!ids.length) return;
    await db.update(followUps).set({ status: "dismissed" }).where(and(inArray(followUps.id, ids), tenantWhere(followUps, ctx)));
  },
};
