import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, ready, schema } from "@/db";
import type { ClaimStatus } from "@/db/schema";
import { computeFollowUps, staleFollowUps } from "./followups";

const { plans, claims, lineItems, followUps, events } = schema;
export const nowSec = () => Math.floor(Date.now() / 1000);

export async function getClaimContext(id: number) {
  await ready();
  const claim = await db.query.claims.findFirst({ where: eq(claims.id, id) });
  if (!claim) return null;
  const [plan, items, fus, evs] = await Promise.all([
    db.query.plans.findFirst({ where: eq(plans.id, claim.planId) }),
    db.select().from(lineItems).where(eq(lineItems.claimId, id)).orderBy(asc(lineItems.serviceDate), asc(lineItems.id)),
    db.select().from(followUps).where(eq(followUps.claimId, id)).orderBy(asc(followUps.dueAt)),
    db.select().from(events).where(eq(events.claimId, id)).orderBy(desc(events.createdAt)),
  ]);
  if (!plan) return null;
  return { claim, plan, lineItems: items, followUps: fus, events: evs };
}

/** Reconcile scheduled follow-ups with the claim's current state. */
export async function syncFollowUps(claimId: number) {
  const ctx = await getClaimContext(claimId);
  if (!ctx) return;
  const stale = staleFollowUps(ctx.claim, ctx.followUps);
  if (stale.length) {
    await db.update(followUps).set({ status: "dismissed" }).where(inArray(followUps.id, stale.map((f) => f.id)));
  }
  const proposed = computeFollowUps(ctx.claim, ctx.plan, ctx.followUps);
  if (proposed.length) {
    await db.insert(followUps).values(proposed.map((p) => ({ claimId, type: p.type, dueAt: p.dueAt })));
  }
}

export async function logEvent(claimId: number, type: string, note?: string) {
  await db.insert(events).values({ claimId, type, note });
}

export async function setStatus(claimId: number, status: ClaimStatus, patch: Partial<typeof claims.$inferInsert> = {}, note?: string) {
  await ready();
  await db.update(claims).set({ status, updatedAt: nowSec(), ...patch }).where(eq(claims.id, claimId));
  await logEvent(claimId, `status:${status}`, note);
  await syncFollowUps(claimId);
}

export async function listClaims() {
  await ready();
  const rows = await db
    .select({ claim: claims, plan: plans })
    .from(claims)
    .innerJoin(plans, eq(plans.id, claims.planId))
    .orderBy(desc(claims.updatedAt));
  const open = await db
    .select()
    .from(followUps)
    .where(inArray(followUps.status, ["pending", "drafted"]))
    .orderBy(asc(followUps.dueAt));
  return { rows, followUps: open };
}

export async function listPlans() {
  await ready();
  return db.select().from(plans).orderBy(asc(plans.insurerName));
}

export async function openFollowUp(id: number) {
  await ready();
  return db.query.followUps.findFirst({ where: and(eq(followUps.id, id)) });
}
