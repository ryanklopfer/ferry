"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireClient } from "@/server/auth/ctx";
import { ConsentRefused, NotOwnedError } from "@/server/errors";
import { recordClientConsents } from "@/server/services/consents";
import { consentInputs, safeNext } from "../../consent-form";

export async function acceptClientReconsent(fd: FormData): Promise<void> {
  const self = await requireClient();
  const next = safeNext(fd.get("next"), "/c");
  const m = String(fd.get("m") ?? "");
  try {
    await recordClientConsents(self, m, consentInputs(fd, await headers()));
  } catch (e) {
    if (e instanceof NotOwnedError) notFound();
    if (e instanceof ConsentRefused) redirect(`/c/reconsent?m=${encodeURIComponent(m)}&next=${encodeURIComponent(next)}&problem=${e.reason}`);
    throw e;
  }
  redirect(next);
}
