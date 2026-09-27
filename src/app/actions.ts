"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireClinician } from "@/server/auth/ctx";
import { NotOwnedError } from "@/server/errors";
import * as claims from "@/server/services/claims";
import * as followUps from "@/server/services/follow-ups";
import * as plans from "@/server/services/plans";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const all = (fd: FormData, k: string) => fd.getAll(k).map((v) => (typeof v === "string" ? v.trim() : ""));
const cents = (v: string | null) => (v ? Math.round(Number(v) * 100) : null);
const noon = (fd: FormData, k: string) => {
  const s = str(fd, k);
  return s ? new Date(`${s}T12:00:00`) : new Date();
};

// Someone else's claim and a claim that does not exist look the same from outside.
async function mine<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (e) {
    if (e instanceof NotOwnedError) notFound();
    throw e;
  }
}

export async function createPlan(fd: FormData) {
  const ctx = await requireClinician();
  const plan = await plans.createPlan(ctx, {
    insurerName: str(fd, "insurerName") ?? "",
    planName: str(fd, "planName"),
    memberId: str(fd, "memberId") ?? "",
    groupNumber: str(fd, "groupNumber"),
    subscriberName: str(fd, "subscriberName") ?? "",
    subscriberDob: str(fd, "subscriberDob"),
    patientName: str(fd, "patientName"),
    patientDob: str(fd, "patientDob"),
    patientRelationship: (str(fd, "patientRelationship") ?? "self") as plans.PlanInput["patientRelationship"],
    patientAddress: str(fd, "patientAddress"),
    patientPhone: str(fd, "patientPhone"),
    patientEmail: str(fd, "patientEmail"),
    claimsAddress: str(fd, "claimsAddress"),
    claimsFax: str(fd, "claimsFax"),
    claimsPhone: str(fd, "claimsPhone"),
    portalUrl: str(fd, "portalUrl"),
    preferredChannel: (str(fd, "preferredChannel") ?? "portal") as plans.PlanInput["preferredChannel"],
    timelyFilingDays: Number(str(fd, "timelyFilingDays") ?? 180) || 180,
  });
  revalidatePath("/");
  redirect(str(fd, "next") === "claim" ? `/claims/new?plan=${plan.id}` : "/plans");
}

export async function createClaimFromUpload(fd: FormData) {
  const ctx = await requireClinician();
  const planId = str(fd, "planId");
  if (!planId) throw new Error("Choose an insurance plan first");
  const upload = fd.get("superbill");
  const file = upload instanceof File && upload.size > 0 ? { name: upload.name, type: upload.type, bytes: Buffer.from(await upload.arrayBuffer()) } : null;
  const claim = await mine(claims.createClaimFromUpload(ctx, { planId, file }));
  redirect(`/claims/${claim.id}/edit`);
}

export async function saveClaim(fd: FormData) {
  const ctx = await requireClinician();
  const id = str(fd, "id") ?? "";
  const [dates, cpts, mods, descs, units, charges, pointers, pos] = ["li_date", "li_cpt", "li_mod", "li_desc", "li_units", "li_charge", "li_dx", "li_pos"].map((k) => all(fd, k));
  const renderingName = str(fd, "renderingProviderName");
  await mine(
    claims.saveClaim(ctx, id, {
      billingProvider: {
        name: str(fd, "billingProviderName") ?? "",
        npi: str(fd, "billingProviderNpi"),
        taxId: str(fd, "billingProviderTaxId"),
        taxIdType: str(fd, "billingProviderTaxIdType") as "EIN" | "SSN" | null,
        address: str(fd, "billingProviderAddress"),
        phone: str(fd, "billingProviderPhone"),
      },
      renderingProvider: renderingName
        ? { name: renderingName, npi: str(fd, "renderingProviderNpi"), credential: str(fd, "renderingProviderCredential"), license: str(fd, "renderingProviderLicense") }
        : null,
      placeOfService: str(fd, "placeOfService") ?? "11",
      diagnosisCodes: (str(fd, "diagnosisCodes") ?? "").split(/[,\s]+/).filter(Boolean),
      lines: cpts
        .map((cptCode, i) => ({
          serviceDate: dates[i] || null,
          cptCode,
          modifiers: (mods[i] ?? "").split(/[\s,-]+/).filter(Boolean),
          description: descs[i] || null,
          units: Number(units[i] || 1),
          charge: cents(charges[i] || "0") ?? 0,
          diagnosisPointers: (pointers[i] || "1").split(/[\s,]+/).filter(Boolean).map(Number),
          placeOfService: pos[i] || null,
        }))
        .filter((l) => l.cptCode),
      totalPaid: cents(str(fd, "totalPaid")),
    }),
  );
  revalidatePath(`/claims/${id}`);
  redirect(`/claims/${id}`);
}

export async function markSubmitted(fd: FormData) {
  const ctx = await requireClinician();
  const id = str(fd, "id") ?? "";
  await mine(claims.markSubmitted(ctx, id, { submittedAt: noon(fd, "submittedAt"), channel: str(fd, "channel") ?? "portal", confirmationNumber: str(fd, "confirmationNumber"), note: str(fd, "note") }));
  revalidatePath(`/claims/${id}`);
  revalidatePath("/");
}

export async function recordOutcome(fd: FormData) {
  const ctx = await requireClinician();
  const id = str(fd, "id") ?? "";
  await mine(
    claims.recordOutcome(ctx, id, {
      outcome: str(fd, "outcome") as claims.Outcome,
      decisionAt: noon(fd, "decisionAt"),
      amountReimbursed: cents(str(fd, "amountReimbursed")),
      reason: str(fd, "reason"),
      confirmationNumber: str(fd, "confirmationNumber"),
    }),
  );
  revalidatePath(`/claims/${id}`);
  revalidatePath("/");
}

export async function markAppealed(fd: FormData) {
  const ctx = await requireClinician();
  const id = str(fd, "id") ?? "";
  await mine(claims.markAppealed(ctx, id, { appealedAt: noon(fd, "appealedAt") }));
  revalidatePath(`/claims/${id}`);
}

export async function closeClaim(fd: FormData) {
  const ctx = await requireClinician();
  const id = str(fd, "id") ?? "";
  await mine(claims.closeClaim(ctx, id, { note: str(fd, "note") }));
  revalidatePath(`/claims/${id}`);
  revalidatePath("/");
}

export async function generateFollowUpDraft(fd: FormData) {
  const ctx = await requireClinician();
  const claimId = await mine(followUps.generateDraft(ctx, str(fd, "id") ?? ""));
  revalidatePath(`/claims/${claimId}`);
}

export async function updateFollowUp(fd: FormData) {
  const ctx = await requireClinician();
  const action = str(fd, "action") as followUps.FollowUpAction["action"];
  const claimId = await mine(followUps.updateFollowUp(ctx, str(fd, "id") ?? "", { action, subject: str(fd, "subject"), body: str(fd, "body") }));
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/");
}

export async function deleteClaim(fd: FormData) {
  const ctx = await requireClinician();
  await claims.deleteClaim(ctx, str(fd, "id") ?? "");
  revalidatePath("/");
  redirect("/");
}
