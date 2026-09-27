import type { ClaimDetail, ClaimSummary } from "@/core/api/claims";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { getClaim, listClaims } from "./claims";
import type { Claim, Plan } from "./types";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

// Fields are picked one by one. Spreading a row here would put every column on the wire.
const summary = (claim: Claim, plan: Plan): ClaimSummary => ({
  id: claim.id,
  status: claim.status,
  insurerName: plan.insurerName,
  billingProviderName: claim.billingProviderName,
  serviceDateStart: claim.serviceDateStart,
  serviceDateEnd: claim.serviceDateEnd,
  totalChargedCents: claim.totalCharged,
  amountReimbursedCents: claim.amountReimbursed,
  updatedAt: claim.updatedAt.toISOString(),
});

export async function listClaimSummaries(ctx: ClinicianOnlyCtx): Promise<{ claims: ClaimSummary[] }> {
  const { rows } = await listClaims(ctx);
  return { claims: rows.map(({ claim, plan }) => summary(claim, plan)) };
}

export async function getClaimDetail(ctx: ClinicianOnlyCtx, id: string): Promise<ClaimDetail | null> {
  const view = await getClaim(ctx, id);
  if (!view) return null;
  const { claim, plan, lines, followUps, events, superbill, deadlines } = view;
  return {
    ...summary(claim, plan),
    planId: plan.id,
    renderingProviderName: claim.renderingProviderName,
    placeOfService: claim.placeOfService,
    diagnosisCodes: claim.diagnosisCodes,
    totalPaidCents: claim.totalPaid,
    hasSuperbill: Boolean(superbill),
    submittedAt: iso(claim.submittedAt),
    decisionAt: iso(claim.decisionAt),
    timelyFilingDeadline: iso(deadlines.timelyFiling),
    appealDeadline: iso(deadlines.appeal),
    lines: lines.map((l) => ({
      serviceDate: l.serviceDate,
      cptCode: l.cptCode,
      modifiers: l.modifiers,
      description: l.description,
      units: l.units,
      chargeCents: l.charge,
      diagnosisPointers: l.diagnosisPointers,
      placeOfService: l.placeOfService,
    })),
    followUps: followUps.filter((f) => f.status !== "dismissed").map((f) => ({ id: f.id, type: f.type, status: f.status, dueAt: f.dueAt.toISOString() })),
    timeline: events.map((e) => ({ type: e.type, at: e.createdAt.toISOString() })),
  };
}
