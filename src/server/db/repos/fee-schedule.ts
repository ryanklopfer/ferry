import { and, asc, notInArray, sql } from "drizzle-orm";
import type { FeeItem } from "@/core/fee-schedule";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { feeScheduleItems } from "../schema";
import { assertNotClient, tenantWhere } from "./scope";

// Clinician-only. Nothing here is sealed: a price list for a code says nothing about any client.
export const feeScheduleRepo = {
  async list(ctx: ClinicianOnlyCtx): Promise<FeeItem[]> {
    assertNotClient(ctx);
    return db
      .select({ cptCode: feeScheduleItems.cptCode, chargeCents: feeScheduleItems.chargeCents })
      .from(feeScheduleItems)
      .where(tenantWhere(feeScheduleItems, ctx))
      .orderBy(asc(feeScheduleItems.cptCode));
  },

  // The whole schedule at once: codes left out are removed, the rest inserted or repriced, in one transaction.
  async replace(ctx: ClinicianOnlyCtx, items: readonly FeeItem[]): Promise<void> {
    assertNotClient(ctx);
    const now = new Date();
    await db.transaction(async (tx) => {
      const keep = items.map((i) => i.cptCode);
      await tx.delete(feeScheduleItems).where(keep.length ? and(tenantWhere(feeScheduleItems, ctx), notInArray(feeScheduleItems.cptCode, keep)) : tenantWhere(feeScheduleItems, ctx));
      if (!items.length) return;
      await tx
        .insert(feeScheduleItems)
        .values(items.map((i) => ({ id: newId("fee"), userId: ctx.userId, cptCode: i.cptCode, chargeCents: i.chargeCents })))
        .onConflictDoUpdate({ target: [feeScheduleItems.userId, feeScheduleItems.cptCode], set: { chargeCents: sql`excluded.charge_cents`, updatedAt: now } });
    });
  },
};
