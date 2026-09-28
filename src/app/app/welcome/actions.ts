"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireClinician, requireSignedIn } from "@/server/auth/ctx";
import { INTENT_COOKIE } from "@/server/auth/intent";
import { authorizeFiling, completeClinicianSignup, completeOnboarding, saveProfile, setFees } from "@/server/services/clinician";
import { requestMeta, typedNameOf } from "../../consent-form";
import { feeEntries, type FormState, formValues, PROFILE_FIELDS, problemOf, profileInput, refusedState } from "../clinician-forms";

// Step 1. The role comes only from the signed intent cookie (services/clinician.ts); nothing in this form names one.
export async function agreeToTerms(fd: FormData): Promise<void> {
  await requireSignedIn();
  const jar = await cookies();
  try {
    await completeClinicianSignup(jar.get(INTENT_COOKIE)?.value, {
      typedName: typedNameOf(fd),
      shown: { terms: String(fd.get("terms") ?? ""), baa: String(fd.get("baa") ?? "") },
      ...requestMeta(await headers()),
    });
  } catch (e) {
    const problem = problemOf(e);
    if (problem) redirect(`/app/welcome?problem=${problem}`);
    throw e;
  }
  jar.delete(INTENT_COOKIE);
  redirect("/app/welcome");
}

export async function savePractice(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireClinician();
  try {
    await saveProfile(ctx, profileInput(fd));
  } catch (e) {
    const state = refusedState(e, formValues(fd, PROFILE_FIELDS));
    if (state) return state;
    throw e;
  }
  redirect("/app/welcome");
}

export async function saveFees(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireClinician();
  const entries = feeEntries(fd);
  try {
    await setFees(ctx, entries);
  } catch (e) {
    const state = refusedState(e, Object.fromEntries(entries.map((f) => [f.cptCode, f.amount])));
    if (state) return state;
    throw e;
  }
  redirect("/app/welcome");
}

export async function signAuthorization(fd: FormData): Promise<void> {
  const ctx = await requireClinician();
  try {
    await authorizeFiling(ctx, { typedName: typedNameOf(fd), shownHash: String(fd.get("shownHash") ?? ""), ...requestMeta(await headers()) });
    await completeOnboarding(ctx);
  } catch (e) {
    const problem = problemOf(e);
    if (problem) redirect(`/app/welcome?problem=${problem}`);
    throw e;
  }
  redirect("/app");
}
