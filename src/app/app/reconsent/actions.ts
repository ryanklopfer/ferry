"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireClinician } from "@/server/auth/ctx";
import { ConsentRefused } from "@/server/errors";
import { recordConsents } from "@/server/services/consents";
import { consentInputs, safeNext } from "../../consent-form";

export async function acceptClinicianReconsent(fd: FormData): Promise<void> {
  const ctx = await requireClinician();
  const next = safeNext(fd.get("next"), "/app");
  try {
    await recordConsents(ctx, consentInputs(fd, await headers()));
  } catch (e) {
    if (e instanceof ConsentRefused) redirect(`/app/reconsent?next=${encodeURIComponent(next)}&problem=${e.reason}`);
    throw e;
  }
  redirect(next);
}
