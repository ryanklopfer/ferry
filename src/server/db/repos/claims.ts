import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { ClinicianOnlyCtx, Ctx } from "@/server/auth/ctx";
import type { Keyring } from "@/server/crypto/tenant-keys";
import { keyringFor } from "./tenant-keys";
import { db } from "../index";
import { decodeRow, decodeRows, encodeRow } from "../codec";
import { newId } from "../ids";
import { type Claim, type ClaimLine, type Plan, claimLines, claims, plans, providers } from "../schema";
import { NotOwnedError } from "@/server/errors";
import { assertNotClient, tenantWhere } from "./scope";

// A claim's client is its plan's client, never an input.
type Insert = typeof claims.$inferInsert;
export type NewClaim = Omit<Insert, "id" | "userId" | "clientId" | "createdAt" | "updatedAt" | "billingProviderTaxIdLast4" | "diagnosisCodes"> & Partial<Pick<Insert, "diagnosisCodes">>;
export type ClaimPatch = Partial<Omit<NewClaim, "planId">>;
export type LineValues = Pick<ClaimLine, "serviceDate" | "cptCode" | "modifiers" | "description" | "units" | "charge" | "diagnosisPointers" | "placeOfService">;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function assertProvidersOwned(tx: Tx, ctx: ClinicianOnlyCtx, ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  if (!wanted.length) return;
  const found = await tx.select({ id: providers.id }).from(providers).where(and(inArray(providers.id, wanted), tenantWhere(providers, ctx)));
  if (found.length !== wanted.length) throw new NotOwnedError("Provider");
}

const lineRows = (ctx: ClinicianOnlyCtx, ring: Keyring, claim: { id: string; clientId: string }, lines: LineValues[]) =>
  lines.map((l, position) => encodeRow(claimLines, ring, { ...l, id: newId("lin"), userId: ctx.userId, clientId: claim.clientId, claimId: claim.id, position }, { insert: true }));

export const claimsRepo = {
  async list(ctx: Ctx): Promise<{ claim: Claim; plan: Plan }[]> {
    const ring = await keyringFor(ctx);
    const rows = await db
      .select({ claim: claims, plan: plans })
      .from(claims)
      .innerJoin(plans, and(eq(plans.id, claims.planId), tenantWhere(plans, ctx)))
      .where(tenantWhere(claims, ctx))
      .orderBy(desc(claims.updatedAt));
    return rows.map((r) => ({ claim: decodeRow(claims, ring, r.claim), plan: decodeRow(plans, ring, r.plan) }));
  },

  async get(ctx: Ctx, id: string): Promise<Claim | null> {
    const ring = await keyringFor(ctx);
    const [row] = await db.select().from(claims).where(and(eq(claims.id, id), tenantWhere(claims, ctx)));
    return row ? decodeRow(claims, ring, row) : null;
  },

  async lines(ctx: Ctx, claimId: string): Promise<ClaimLine[]> {
    const ring = await keyringFor(ctx);
    return decodeRows(claimLines, ring, await db.select().from(claimLines).where(and(eq(claimLines.claimId, claimId), tenantWhere(claimLines, ctx))).orderBy(asc(claimLines.position)));
  },

  async create(ctx: ClinicianOnlyCtx, values: NewClaim, lines: LineValues[]): Promise<Claim> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    return db.transaction(async (tx) => {
      const [plan] = await tx.select({ id: plans.id, clientId: plans.clientId }).from(plans).where(and(eq(plans.id, values.planId), tenantWhere(plans, ctx)));
      if (!plan) throw new NotOwnedError("Plan");
      await assertProvidersOwned(tx, ctx, [values.billingProviderId, values.renderingProviderId]);
      const [claim] = await tx.insert(claims).values(encodeRow(claims, ring, { ...values, id: newId("clm"), userId: ctx.userId, clientId: plan.clientId } as Insert, { insert: true })).returning();
      if (lines.length) await tx.insert(claimLines).values(lineRows(ctx, ring, claim, lines));
      return decodeRow(claims, ring, claim);
    });
  },

  async update(ctx: ClinicianOnlyCtx, id: string, patch: ClaimPatch): Promise<Claim | null> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    return db.transaction(async (tx) => {
      await assertProvidersOwned(tx, ctx, [patch.billingProviderId, patch.renderingProviderId]);
      const [row] = await tx.update(claims).set(encodeRow(claims, ring, { ...patch, updatedAt: new Date() }, { id })).where(and(eq(claims.id, id), tenantWhere(claims, ctx))).returning();
      return row ? decodeRow(claims, ring, row) : null;
    });
  },

  // Patch and lines land together or not at all.
  async save(ctx: ClinicianOnlyCtx, id: string, patch: ClaimPatch, lines: LineValues[]): Promise<Claim | null> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    return db.transaction(async (tx) => {
      await assertProvidersOwned(tx, ctx, [patch.billingProviderId, patch.renderingProviderId]);
      const [row] = await tx.update(claims).set(encodeRow(claims, ring, { ...patch, updatedAt: new Date() }, { id })).where(and(eq(claims.id, id), tenantWhere(claims, ctx))).returning();
      if (!row) return null;
      await tx.delete(claimLines).where(and(eq(claimLines.claimId, id), tenantWhere(claimLines, ctx)));
      if (lines.length) await tx.insert(claimLines).values(lineRows(ctx, ring, row, lines));
      return decodeRow(claims, ring, row);
    });
  },

  async replaceLines(ctx: ClinicianOnlyCtx, id: string, lines: LineValues[]): Promise<boolean> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    return db.transaction(async (tx) => {
      const [claim] = await tx.select({ id: claims.id, clientId: claims.clientId }).from(claims).where(and(eq(claims.id, id), tenantWhere(claims, ctx)));
      if (!claim) return false;
      await tx.delete(claimLines).where(and(eq(claimLines.claimId, id), tenantWhere(claimLines, ctx)));
      if (lines.length) await tx.insert(claimLines).values(lineRows(ctx, ring, claim, lines));
      return true;
    });
  },

  async remove(ctx: ClinicianOnlyCtx, id: string): Promise<boolean> {
    assertNotClient(ctx);
    const removed = await db.delete(claims).where(and(eq(claims.id, id), tenantWhere(claims, ctx))).returning({ id: claims.id });
    return removed.length > 0;
  },
};
