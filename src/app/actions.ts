"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { db, ready, schema } from "@/db";
import type { ClaimStatus } from "@/db/schema";
import { aiEnabled, draftFollowUp, extractSuperbill } from "@/lib/ai";
import { toCents } from "@/lib/extraction";
import { getClaimContext, logEvent, nowSec, setStatus, syncFollowUps } from "@/lib/service";

const { plans, claims, lineItems, followUps } = schema;

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const num = (fd: FormData, k: string) => Number(str(fd, k) ?? 0);
const dateSec = (fd: FormData, k: string) => {
  const s = str(fd, k);
  return s ? Math.floor(Date.parse(s + "T12:00:00") / 1000) : nowSec();
};

export async function createPlan(fd: FormData) {
  await ready();
  const [row] = await db
    .insert(plans)
    .values({
      insurerName: str(fd, "insurerName")!,
      planName: str(fd, "planName"),
      memberId: str(fd, "memberId")!,
      groupNumber: str(fd, "groupNumber"),
      subscriberName: str(fd, "subscriberName")!,
      subscriberDob: str(fd, "subscriberDob"),
      patientName: str(fd, "patientName") ?? str(fd, "subscriberName")!,
      patientDob: str(fd, "patientDob") ?? str(fd, "subscriberDob"),
      patientRelationship: str(fd, "patientRelationship") ?? "self",
      patientAddress: str(fd, "patientAddress"),
      patientPhone: str(fd, "patientPhone"),
      patientEmail: str(fd, "patientEmail"),
      claimsAddress: str(fd, "claimsAddress"),
      claimsFax: str(fd, "claimsFax"),
      claimsPhone: str(fd, "claimsPhone"),
      portalUrl: str(fd, "portalUrl"),
      preferredChannel: str(fd, "preferredChannel") ?? "portal",
      timelyFilingDays: num(fd, "timelyFilingDays") || 180,
    })
    .returning({ id: plans.id });
  revalidatePath("/");
  redirect(str(fd, "next") === "claim" ? `/claims/new?plan=${row.id}` : "/plans");
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

export async function createClaimFromUpload(fd: FormData) {
  await ready();
  const planId = num(fd, "planId");
  const file = fd.get("superbill");
  if (!planId) throw new Error("Choose an insurance plan first");

  let superbillPath: string | null = null;
  let superbillMime: string | null = null;
  let extraction = null;
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED.has(file.type)) throw new Error("Upload a JPG, PNG, WEBP, GIF, or PDF");
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : ".jpg");
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    await fs.writeFile(path.join(process.cwd(), "data", "uploads", name), bytes);
    superbillPath = name;
    superbillMime = file.type;
    try {
      extraction = await extractSuperbill(bytes, file.type);
    } catch (e) {
      extraction = { notes: `Extraction failed: ${e instanceof Error ? e.message : String(e)}. Enter fields manually.` };
    }
  }

  const items = extraction && "lineItems" in extraction ? extraction.lineItems : [];
  const dates = items.map((i) => i.serviceDate).filter((d): d is string => Boolean(d)).sort();
  const x = extraction && "providerName" in extraction ? extraction : null;
  const [row] = await db
    .insert(claims)
    .values({
      planId,
      providerName: x?.providerName ?? null,
      providerNpi: x?.providerNpi ?? null,
      providerTaxId: x?.providerTaxId ?? null,
      providerAddress: x?.providerAddress ?? null,
      providerPhone: x?.providerPhone ?? null,
      placeOfService: x?.placeOfService ?? "11",
      diagnosisCodes: x?.diagnosisCodes ?? [],
      serviceDateStart: dates[0] ?? null,
      serviceDateEnd: dates[dates.length - 1] ?? null,
      totalCharged: toCents(x?.totalCharged ?? items.reduce((s, i) => s + i.charge, 0)),
      totalPaid: toCents(x?.totalPaid ?? x?.totalCharged ?? items.reduce((s, i) => s + i.charge, 0)),
      superbillPath,
      superbillMime,
      extractionNotes: extraction?.notes ?? null,
    })
    .returning({ id: claims.id });

  if (items.length) {
    await db.insert(lineItems).values(
      items.map((i) => ({ claimId: row.id, serviceDate: i.serviceDate, cptCode: i.cptCode, modifier: i.modifier, description: i.description, units: i.units, charge: toCents(i.charge) })),
    );
  }
  await logEvent(row.id, "created", superbillPath ? `Superbill uploaded${aiEnabled() ? `; AI extracted ${items.length} line item(s)` : ""}` : "Created without superbill");
  await syncFollowUps(row.id);
  redirect(`/claims/${row.id}/edit`);
}

export async function saveClaim(fd: FormData) {
  await ready();
  const id = num(fd, "id");
  const rows = fd.getAll("li_cpt").map((_, i) => ({
    claimId: id,
    serviceDate: (fd.getAll("li_date")[i] as string) || null,
    cptCode: (fd.getAll("li_cpt")[i] as string).trim(),
    modifier: (fd.getAll("li_mod")[i] as string) || null,
    description: (fd.getAll("li_desc")[i] as string) || null,
    units: Number(fd.getAll("li_units")[i] || 1),
    charge: toCents(Number(fd.getAll("li_charge")[i] || 0)),
  })).filter((r) => r.cptCode);
  const dates = rows.map((r) => r.serviceDate).filter((d): d is string => Boolean(d)).sort();
  const total = rows.reduce((s, r) => s + r.charge, 0);

  await db
    .update(claims)
    .set({
      providerName: str(fd, "providerName"),
      providerNpi: str(fd, "providerNpi"),
      providerTaxId: str(fd, "providerTaxId"),
      providerAddress: str(fd, "providerAddress"),
      providerPhone: str(fd, "providerPhone"),
      placeOfService: str(fd, "placeOfService") ?? "11",
      diagnosisCodes: (str(fd, "diagnosisCodes") ?? "").split(/[,\s]+/).filter(Boolean).map((c) => c.toUpperCase()),
      serviceDateStart: str(fd, "serviceDateStart") ?? dates[0] ?? null,
      serviceDateEnd: str(fd, "serviceDateEnd") ?? dates[dates.length - 1] ?? null,
      totalCharged: total,
      totalPaid: str(fd, "totalPaid") ? toCents(num(fd, "totalPaid")) : total,
      updatedAt: nowSec(),
    })
    .where(eq(claims.id, id));
  await db.delete(lineItems).where(eq(lineItems.claimId, id));
  if (rows.length) await db.insert(lineItems).values(rows);
  await syncFollowUps(id);
  revalidatePath(`/claims/${id}`);
  redirect(`/claims/${id}`);
}

export async function markSubmitted(fd: FormData) {
  const id = num(fd, "id");
  await setStatus(id, "submitted", { submittedAt: dateSec(fd, "submittedAt"), submissionChannel: str(fd, "channel") ?? "portal", confirmationNumber: str(fd, "confirmationNumber") }, str(fd, "note") ?? undefined);
  revalidatePath(`/claims/${id}`);
  revalidatePath("/");
}

export async function recordOutcome(fd: FormData) {
  const id = num(fd, "id");
  const outcome = str(fd, "outcome") as ClaimStatus;
  const decisionAt = dateSec(fd, "decisionAt");
  const patch: Partial<typeof claims.$inferInsert> = { decisionAt };
  if (outcome === "paid") patch.amountReimbursed = toCents(num(fd, "amountReimbursed"));
  if (outcome === "denied") patch.denialReason = str(fd, "reason");
  if (outcome === "info_requested") patch.infoRequested = str(fd, "reason");
  if (str(fd, "confirmationNumber")) patch.confirmationNumber = str(fd, "confirmationNumber");
  await setStatus(id, outcome, patch, str(fd, "reason") ?? undefined);
  revalidatePath(`/claims/${id}`);
  revalidatePath("/");
}

export async function markAppealed(fd: FormData) {
  const id = num(fd, "id");
  await setStatus(id, "appealed", { decisionAt: dateSec(fd, "appealedAt") }, "Appeal sent");
  revalidatePath(`/claims/${id}`);
}

export async function closeClaim(fd: FormData) {
  const id = num(fd, "id");
  await setStatus(id, "closed", {}, str(fd, "note") ?? undefined);
  revalidatePath(`/claims/${id}`);
  revalidatePath("/");
}

export async function generateFollowUpDraft(fd: FormData) {
  await ready();
  const id = num(fd, "id");
  const fu = await db.query.followUps.findFirst({ where: eq(followUps.id, id) });
  if (!fu) return;
  const ctx = await getClaimContext(fu.claimId);
  if (!ctx) return;
  const draft = await draftFollowUp(fu.type, ctx);
  await db.update(followUps).set({ status: "drafted", draftSubject: draft.subject, draftBody: draft.body }).where(eq(followUps.id, id));
  await logEvent(fu.claimId, "followup:drafted", draft.subject);
  revalidatePath(`/claims/${fu.claimId}`);
}

export async function updateFollowUp(fd: FormData) {
  await ready();
  const id = num(fd, "id");
  const action = str(fd, "action");
  const fu = await db.query.followUps.findFirst({ where: eq(followUps.id, id) });
  if (!fu) return;
  if (action === "sent") {
    await db.update(followUps).set({ status: "sent", sentAt: nowSec(), draftSubject: str(fd, "subject") ?? fu.draftSubject, draftBody: str(fd, "body") ?? fu.draftBody }).where(eq(followUps.id, id));
    await logEvent(fu.claimId, "followup:sent", fu.draftSubject ?? fu.type);
  } else if (action === "dismiss") {
    await db.update(followUps).set({ status: "dismissed" }).where(eq(followUps.id, id));
  } else if (action === "save") {
    await db.update(followUps).set({ draftSubject: str(fd, "subject"), draftBody: str(fd, "body") }).where(eq(followUps.id, id));
  }
  revalidatePath(`/claims/${fu.claimId}`);
  revalidatePath("/");
}

export async function deleteClaim(fd: FormData) {
  await ready();
  const id = num(fd, "id");
  await db.delete(lineItems).where(eq(lineItems.claimId, id));
  await db.delete(followUps).where(eq(followUps.claimId, id));
  await db.delete(schema.events).where(eq(schema.events.claimId, id));
  await db.delete(claims).where(eq(claims.id, id));
  revalidatePath("/");
  redirect("/");
}
