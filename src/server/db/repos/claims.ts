import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { type Claim, type ClaimLine, type Plan, claimLines, claims, plans, providers } from "../schema";
import { NotOwnedError } from "@/server/errors";

export type NewClaim = Omit<typeof claims.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">;
export type ClaimPatch = Partial<Omit<NewClaim, "planId">>;
export type LineValues = Pick<ClaimLine, "serviceDate" | "cptCode" | "modifiers" | "description" | "units" | "charge" | "diagnosisPointers" | "placeOfService">;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function assertProvidersOwned(tx: Tx, ctx: ClinicianOnlyCtx, ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  if (!wanted.length) return;
  const found = await tx.select({ id: providers.id }).from(providers).where(and(inArray(providers.id, wanted), eq(providers.userId, ctx.userId)));
  if (found.length !== wanted.length) throw new NotOwnedError("Provider");
}

const lineRows = (ctx: ClinicianOnlyCtx, claimId: string, lines: LineValues[]) =>
  lines.map((l, position) => ({ ...l, id: newId("lin"), userId: ctx.userId, claimId, position }));

export const claimsRepo = {
  list(ctx: ClinicianOnlyCtx): Promise<{ claim: Claim; plan: Plan }[]> {
    return db
      .select({ claim: claims, plan: plans })
      .from(claims)
      .innerJoin(plans, and(eq(plans.id, claims.planId), eq(plans.userId, ctx.userId)))
      .where(eq(claims.userId, ctx.userId))
      .orderBy(desc(claims.updatedAt));
  },

  async get(ctx: ClinicianOnlyCtx, id: string): Promise<Claim | null> {
    const [row] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.userId, ctx.userId)));
    return row ?? null;
  },

  lines(ctx: ClinicianOnlyCtx, claimId: string): Promise<ClaimLine[]> {
    return db.select().from(claimLines).where(and(eq(claimLines.claimId, claimId), eq(claimLines.userId, ctx.userId))).orderBy(asc(claimLines.position));
  },

  create(ctx: ClinicianOnlyCtx, values: NewClaim, lines: LineValues[]): Promise<Claim> {
    return db.transaction(async (tx) => {
      const [plan] = await tx.select({ id: plans.id }).from(plans).where(and(eq(plans.id, values.planId), eq(plans.userId, ctx.userId)));
      if (!plan) throw new NotOwnedError("Plan");
      await assertProvidersOwned(tx, ctx, [values.billingProviderId, values.renderingProviderId]);
      const [claim] = await tx.insert(claims).values({ ...values, id: newId("clm"), userId: ctx.userId }).returning();
      if (lines.length) await tx.insert(claimLines).values(lineRows(ctx, claim.id, lines));
      return claim;
    });
  },

  update(ctx: ClinicianOnlyCtx, id: string, patch: ClaimPatch): Promise<Claim | null> {
    return db.transaction(async (tx) => {
      await assertProvidersOwned(tx, ctx, [patch.billingProviderId, patch.renderingProviderId]);
      const [row] = await tx.update(claims).set({ ...patch, updatedAt: new Date() }).where(and(eq(claims.id, id), eq(claims.userId, ctx.userId))).returning();
      return row ?? null;
    });
  },

  // Patch and lines land together or not at all.
  save(ctx: ClinicianOnlyCtx, id: string, patch: ClaimPatch, lines: LineValues[]): Promise<Claim | null> {
    return db.transaction(async (tx) => {
      await assertProvidersOwned(tx, ctx, [patch.billingProviderId, patch.renderingProviderId]);
      const [row] = await tx.update(claims).set({ ...patch, updatedAt: new Date() }).where(and(eq(claims.id, id), eq(claims.userId, ctx.userId))).returning();
      if (!row) return null;
      await tx.delete(claimLines).where(and(eq(claimLines.claimId, id), eq(claimLines.userId, ctx.userId)));
      if (lines.length) await tx.insert(claimLines).values(lineRows(ctx, id, lines));
      return row;
    });
  },

  replaceLines(ctx: ClinicianOnlyCtx, id: string, lines: LineValues[]): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [claim] = await tx.select({ id: claims.id }).from(claims).where(and(eq(claims.id, id), eq(claims.userId, ctx.userId)));
      if (!claim) return false;
      await tx.delete(claimLines).where(and(eq(claimLines.claimId, id), eq(claimLines.userId, ctx.userId)));
      if (lines.length) await tx.insert(claimLines).values(lineRows(ctx, id, lines));
      return true;
    });
  },

  async remove(ctx: ClinicianOnlyCtx, id: string): Promise<boolean> {
    const removed = await db.delete(claims).where(and(eq(claims.id, id), eq(claims.userId, ctx.userId))).returning({ id: claims.id });
    return removed.length > 0;
  },
};
