import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { aiEnabled, extractSuperbill } from "@/lib/ai";
import { toCents } from "@/lib/extraction";
import { appealDeadline, computeFollowUps, staleFollowUps, timelyFilingDeadline } from "@/lib/followups";
import { fromSec, toEngineClaim, toEngineFollowUp } from "@/lib/followups-adapter";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { newId } from "@/server/db/ids";
import { type ClaimPatch, claimsRepo } from "@/server/db/repos/claims";
import { documentsRepo } from "@/server/db/repos/documents";
import { NotOwnedError } from "@/server/errors";
import { eventsRepo } from "@/server/db/repos/events";
import { followUpsRepo } from "@/server/db/repos/follow-ups";
import { plansRepo } from "@/server/db/repos/plans";
import { providersRepo } from "@/server/db/repos/providers";
import { logFor } from "@/server/log";
import { deleteFile, putFile } from "@/server/storage/local";
import type { Claim, ClaimStatus, ClaimView } from "./types";

const ALLOWED_UPLOADS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

const text = z.string().trim().min(1);
const optional = text.nullish().transform((v) => v ?? null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const LineInputSchema = z.object({
  serviceDate: isoDate.nullish().transform((v) => v ?? null),
  cptCode: z.string().trim().toUpperCase().regex(/^[0-9A-Z]{5}$/, "A procedure code is 5 characters"),
  modifiers: z.array(z.string().trim().toUpperCase().regex(/^[0-9A-Z]{2}$/, "A modifier is 2 characters")).max(4, "A line takes at most 4 modifiers"),
  description: optional,
  units: z.number().int().min(1),
  charge: z.number().int().min(0),
  diagnosisPointers: z.array(z.number().int().min(1).max(12)).min(1).max(4),
  placeOfService: z.string().regex(/^\d{2}$/).nullish().transform((v) => v ?? null),
});

export const ClaimInputSchema = z.object({
  billingProvider: z.object({
    name: text,
    npi: z.string().regex(/^\d{10}$/, "An NPI is 10 digits").nullish().transform((v) => v ?? null),
    taxId: optional,
    taxIdType: z.enum(["EIN", "SSN"]).nullish().transform((v) => v ?? null),
    address: optional,
    phone: optional,
  }),
  renderingProvider: z
    .object({
      name: text,
      npi: z.string().regex(/^\d{10}$/, "An NPI is 10 digits").nullish().transform((v) => v ?? null),
      credential: optional,
      license: optional,
    })
    .nullish()
    .transform((v) => v ?? null),
  placeOfService: z.string().regex(/^\d{2}$/).default("11"),
  diagnosisCodes: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]\d{2}(\.[0-9A-Z]{1,4})?$/, "Not an ICD-10 code")).max(12),
  lines: z.array(LineInputSchema),
  totalPaid: z.number().int().min(0).nullish().transform((v) => v ?? null),
});
export type ClaimInput = z.input<typeof ClaimInputSchema>;

async function owned(ctx: ClinicianOnlyCtx, id: string): Promise<Claim> {
  const claim = await claimsRepo.get(ctx, id);
  if (!claim) throw new NotOwnedError("Claim");
  return claim;
}

async function syncFollowUps(ctx: ClinicianOnlyCtx, claimId: string): Promise<void> {
  const claim = await claimsRepo.get(ctx, claimId);
  if (!claim) return;
  const plan = await plansRepo.get(ctx, claim.planId);
  if (!plan) return;
  const existing = (await followUpsRepo.forClaim(ctx, claimId)).map(toEngineFollowUp);
  const engineClaim = toEngineClaim(claim);
  const proposed = computeFollowUps(engineClaim, plan, existing);
  // A pending follow-up of a type being re-proposed with a new due date has been superseded, not joined.
  const superseded = existing.filter((f) => f.status === "pending" && proposed.some((p) => p.type === f.type));
  await followUpsRepo.dismiss(ctx, [...staleFollowUps(engineClaim, existing), ...superseded].map((f) => f.id));
  await followUpsRepo.createMany(ctx, claimId, proposed.map((p) => ({ type: p.type, dueAt: fromSec(p.dueAt) })));
}

async function setStatus(ctx: ClinicianOnlyCtx, id: string, status: ClaimStatus, patch: ClaimPatch, note?: string | null): Promise<void> {
  await owned(ctx, id);
  await claimsRepo.update(ctx, id, { ...patch, status });
  await eventsRepo.append(ctx, id, `status:${status}`, note ?? undefined);
  await syncFollowUps(ctx, id);
  logFor(id)("claim.status", { userId: ctx.userId, status });
}

export async function listClaims(ctx: ClinicianOnlyCtx) {
  const [rows, followUps] = await Promise.all([claimsRepo.list(ctx), followUpsRepo.open(ctx)]);
  return { rows, followUps };
}

export async function getClaim(ctx: ClinicianOnlyCtx, id: string): Promise<ClaimView | null> {
  const claim = await claimsRepo.get(ctx, id);
  if (!claim) return null;
  const plan = await plansRepo.get(ctx, claim.planId);
  if (!plan) return null;
  const [lines, followUps, events, superbills] = await Promise.all([
    claimsRepo.lines(ctx, id),
    followUpsRepo.forClaim(ctx, id),
    eventsRepo.forClaim(ctx, id),
    documentsRepo.forClaim(ctx, id, "superbill"),
  ]);
  const engineClaim = toEngineClaim(claim);
  const filing = timelyFilingDeadline(engineClaim, plan);
  const appeal = appealDeadline(engineClaim);
  return {
    claim,
    plan,
    lines,
    followUps,
    events,
    superbill: superbills[0] ?? null,
    deadlines: { timelyFiling: filing ? fromSec(filing) : null, appeal: appeal ? fromSec(appeal) : null },
  };
}

export type Upload = { name: string; type: string; bytes: Buffer };

export async function createClaimFromUpload(ctx: ClinicianOnlyCtx, input: { planId: string; file?: Upload | null }): Promise<Claim> {
  const plan = await plansRepo.get(ctx, input.planId);
  if (!plan) throw new NotOwnedError("Plan");
  const file = input.file && input.file.bytes.length > 0 ? input.file : null;
  if (file && !ALLOWED_UPLOADS.has(file.type)) throw new Error("Upload a JPG, PNG, WEBP, GIF, or PDF");

  let notes: string | null = null;
  let extraction: Awaited<ReturnType<typeof extractSuperbill>> | null = null;
  if (file) {
    try {
      extraction = await extractSuperbill(file.bytes, file.type);
      notes = extraction.notes;
    } catch (e) {
      notes = `Extraction failed: ${e instanceof Error ? e.message : String(e)}. Enter fields manually.`;
    }
  }

  const items = extraction?.lineItems ?? [];
  const dates = items.map((i) => i.serviceDate).filter((d): d is string => Boolean(d)).sort();
  const charged = toCents(extraction?.totalCharged ?? items.reduce((s, i) => s + i.charge, 0));
  const placeOfService = extraction?.placeOfService ?? "11";
  const claim = await claimsRepo.create(
    ctx,
    {
      planId: plan.id,
      billingProviderName: extraction?.providerName ?? null,
      billingProviderNpi: extraction?.providerNpi ?? null,
      billingProviderTaxId: extraction?.providerTaxId ?? null,
      billingProviderAddress: extraction?.providerAddress ?? null,
      billingProviderPhone: extraction?.providerPhone ?? null,
      placeOfService,
      diagnosisCodes: extraction?.diagnosisCodes ?? [],
      serviceDateStart: dates[0] ?? null,
      serviceDateEnd: dates[dates.length - 1] ?? null,
      totalCharged: charged,
      totalPaid: extraction?.totalPaid != null ? toCents(extraction.totalPaid) : charged,
      extractionNotes: notes,
    },
    items.map((i) => ({
      serviceDate: i.serviceDate,
      cptCode: i.cptCode,
      modifiers: i.modifier ? [i.modifier] : [],
      description: i.description,
      units: i.units,
      charge: toCents(i.charge),
      diagnosisPointers: [1],
      placeOfService,
    })),
  );

  if (file) {
    const id = newId("doc");
    const ext = path.extname(file.name).toLowerCase() || (file.type === "application/pdf" ? ".pdf" : ".jpg");
    const storageKey = `${ctx.userId}/${id}${ext}`;
    await putFile(storageKey, file.bytes);
    await documentsRepo.create(ctx, { id, claimId: claim.id, kind: "superbill", storageKey, mime: file.type, bytes: file.bytes.length, sha256: createHash("sha256").update(file.bytes).digest("hex") });
  }

  const how = file ? `Superbill uploaded${aiEnabled() ? `; AI extracted ${items.length} line item(s)` : ""}` : "Created without superbill";
  await eventsRepo.append(ctx, claim.id, "created", how);
  await syncFollowUps(ctx, claim.id);
  logFor(claim.id)("claim.created", { userId: ctx.userId, planId: plan.id, count: items.length, bytes: file?.bytes.length ?? 0 });
  return claim;
}

export async function saveClaim(ctx: ClinicianOnlyCtx, id: string, input: ClaimInput): Promise<void> {
  await owned(ctx, id);
  const v = ClaimInputSchema.parse(input);
  for (const line of v.lines) {
    const missing = line.diagnosisPointers.find((p) => p > v.diagnosisCodes.length);
    if (missing) throw new Error(`Line ${line.cptCode} points at diagnosis ${missing}, but only ${v.diagnosisCodes.length} diagnosis code(s) are listed`);
  }

  const billing = await providersRepo.upsertByNpiOrName(ctx, v.billingProvider);
  const sameAsBilling = v.renderingProvider && (v.renderingProvider.npi ? v.renderingProvider.npi === v.billingProvider.npi : v.renderingProvider.name === v.billingProvider.name);
  const rendering = v.renderingProvider && !sameAsBilling ? await providersRepo.upsertByNpiOrName(ctx, v.renderingProvider) : null;

  const lines = v.lines.map((l) => ({ ...l, placeOfService: l.placeOfService ?? v.placeOfService }));
  const dates = lines.map((l) => l.serviceDate).filter((d): d is string => Boolean(d)).sort();
  const total = lines.reduce((s, l) => s + l.charge, 0);

  const saved = await claimsRepo.save(
    ctx,
    id,
    {
      billingProviderId: billing.id,
      renderingProviderId: rendering?.id ?? null,
      billingProviderName: v.billingProvider.name,
      billingProviderNpi: v.billingProvider.npi,
      billingProviderTaxId: v.billingProvider.taxId,
      billingProviderTaxIdType: v.billingProvider.taxIdType,
      billingProviderAddress: v.billingProvider.address,
      billingProviderPhone: v.billingProvider.phone,
      renderingProviderName: v.renderingProvider?.name ?? null,
      renderingProviderNpi: v.renderingProvider?.npi ?? null,
      renderingProviderCredential: v.renderingProvider?.credential ?? null,
      renderingProviderLicense: v.renderingProvider?.license ?? null,
      placeOfService: v.placeOfService,
      diagnosisCodes: v.diagnosisCodes,
      serviceDateStart: dates[0] ?? null,
      serviceDateEnd: dates[dates.length - 1] ?? null,
      totalCharged: total,
      totalPaid: v.totalPaid ?? total,
    },
    lines,
  );
  if (!saved) throw new NotOwnedError("Claim");
  await syncFollowUps(ctx, id);
}

export function markSubmitted(ctx: ClinicianOnlyCtx, id: string, input: { submittedAt: Date; channel: string; confirmationNumber: string | null; note: string | null }): Promise<void> {
  return setStatus(ctx, id, "submitted", { submittedAt: input.submittedAt, submissionChannel: input.channel, confirmationNumber: input.confirmationNumber }, input.note);
}

export type Outcome = Extract<ClaimStatus, "acknowledged" | "paid" | "denied" | "info_requested">;

export function recordOutcome(ctx: ClinicianOnlyCtx, id: string, input: { outcome: Outcome; decisionAt: Date; amountReimbursed: number | null; reason: string | null; confirmationNumber: string | null }): Promise<void> {
  const patch: ClaimPatch = { decisionAt: input.decisionAt };
  if (input.outcome === "paid") patch.amountReimbursed = input.amountReimbursed ?? 0;
  if (input.outcome === "denied") patch.denialReason = input.reason;
  if (input.outcome === "info_requested") patch.infoRequested = input.reason;
  if (input.confirmationNumber) patch.confirmationNumber = input.confirmationNumber;
  return setStatus(ctx, id, input.outcome, patch, input.reason);
}

export function markAppealed(ctx: ClinicianOnlyCtx, id: string, input: { appealedAt: Date }): Promise<void> {
  return setStatus(ctx, id, "appealed", { decisionAt: input.appealedAt }, "Appeal sent");
}

export function closeClaim(ctx: ClinicianOnlyCtx, id: string, input: { note: string | null }): Promise<void> {
  return setStatus(ctx, id, "closed", {}, input.note);
}

export async function deleteClaim(ctx: ClinicianOnlyCtx, id: string): Promise<void> {
  const docs = await documentsRepo.forClaim(ctx, id);
  if (!(await claimsRepo.remove(ctx, id))) return;
  await Promise.all(docs.map((d) => deleteFile(d.storageKey)));
  logFor(id)("claim.deleted", { userId: ctx.userId, count: docs.length });
}
