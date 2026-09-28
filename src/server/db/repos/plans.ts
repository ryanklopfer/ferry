import { and, asc, eq } from "drizzle-orm";
import type { ClinicianOnlyCtx, Ctx } from "@/server/auth/ctx";
import { keyringFor } from "@/server/crypto/tenant-keys";
import { db } from "../index";
import { blindFor, decodeRow, decodeRows, encodeRow } from "../codec";
import { newId } from "../ids";
import { type Plan, clients, plans } from "../schema";
import { NotOwnedError } from "@/server/errors";
import { assertNotClient, tenantWhere } from "./scope";

type Insert = typeof plans.$inferInsert;
export type NewPlan = Omit<Insert, "id" | "userId" | "clientId" | "createdAt" | "memberIdBidx" | "patientRelationship"> & Partial<Pick<Insert, "patientRelationship">>;

export const plansRepo = {
  async list(ctx: Ctx): Promise<Plan[]> {
    const ring = await keyringFor(ctx);
    return decodeRows(plans, ring, await db.select().from(plans).where(tenantWhere(plans, ctx)).orderBy(asc(plans.insurerName), asc(plans.createdAt)));
  },

  async get(ctx: Ctx, id: string): Promise<Plan | null> {
    const ring = await keyringFor(ctx);
    const [row] = await db.select().from(plans).where(and(eq(plans.id, id), tenantWhere(plans, ctx)));
    return row ? decodeRow(plans, ring, row) : null;
  },

  // Ids only, through the blind index: nothing is decrypted to find them.
  async idsByMemberId(ctx: Ctx, memberId: string): Promise<string[]> {
    const ring = await keyringFor(ctx);
    const rows = await db.select({ id: plans.id }).from(plans).where(and(eq(plans.memberIdBidx, blindFor(plans, "memberIdBidx", ring, memberId)), tenantWhere(plans, ctx)));
    return rows.map((r) => r.id);
  },

  async create(ctx: ClinicianOnlyCtx, clientId: string, values: NewPlan): Promise<Plan> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    return db.transaction(async (tx) => {
      const [client] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), tenantWhere(clients, ctx)));
      if (!client) throw new NotOwnedError("Client");
      const [row] = await tx.insert(plans).values(encodeRow(plans, ring, { ...values, id: newId("pln"), userId: ctx.userId, clientId } as Insert, { insert: true })).returning();
      return decodeRow(plans, ring, row);
    });
  },
};
