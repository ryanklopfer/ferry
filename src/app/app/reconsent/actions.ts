"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireClinician } from "@/server/auth/ctx";
import { ConsentRefused } from "@/server/errors";
import { recordConsent } from "@/server/services/consents";
import { consentInputs, safeNext } from "../../consent-form";

export async function acceptClinicianReconsent(fd: FormData): Promise<void> {
  const ctx = await requireClinician();
  const next = safeNext(fd.get("next"), "/app");
  try {
    for (const input of consentInputs(fd, await headers())) await recordConsent(ctx, input);
  } catch (e) {
    if (e instanceof ConsentRefused) redirect(`/app/reconsent?next=${encodeURIComponent(next)}&problem=${e.reason}`);
    throw e;
  }
  redirect(next);
}
