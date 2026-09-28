"use server";

import { redirect } from "next/navigation";
import { requireClinician } from "@/server/auth/ctx";
import { saveProfile, setFees } from "@/server/services/clinician";
import { feeEntries, type FormState, formValues, PROFILE_FIELDS, profileInput, refusedState } from "../clinician-forms";

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireClinician();
  try {
    await saveProfile(ctx, profileInput(fd));
  } catch (e) {
    const state = refusedState(e, formValues(fd, PROFILE_FIELDS));
    if (state) return state;
    throw e;
  }
  redirect("/app/account/profile?saved=1");
}

export async function updateFees(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireClinician();
  const entries = feeEntries(fd);
  try {
    await setFees(ctx, entries);
  } catch (e) {
    const state = refusedState(e, Object.fromEntries(entries.map((f) => [f.cptCode, f.amount])));
    if (state) return state;
    throw e;
  }
  redirect("/app/account/fees?saved=1");
}
