"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSignedIn } from "@/server/auth/ctx";
import { INTENT_COOKIE, intentCookieOptions } from "@/server/auth/intent";
import { log } from "@/server/log";
import { continueClinicianSignup, startClinicianSignup } from "@/server/services/clinician";

export type StartState = { kind: "idle" } | { kind: "sent"; to: string } | { kind: "refused"; message: string } | { kind: "mailto"; href: string } | { kind: "problem" };

// The one action a signed-out visitor may call (guards.test.ts PUBLIC_ACTIONS). It reads the email and nothing else:
// no role, no card, no name.
export async function startClinicianSignupAction(_: StartState, fd: FormData): Promise<StartState> {
  const email = z.email().max(254).safeParse(String(fd.get("email") ?? "").trim());
  if (!email.success) return { kind: "problem" };
  let result;
  try {
    result = await startClinicianSignup(email.data, await headers());
  } catch (e) {
    log("signup.start_failed", { error: e });
    return { kind: "problem" };
  }
  if (result.kind !== "sent") return result;
  (await cookies()).set(INTENT_COOKIE, result.intent, intentCookieOptions());
  return { kind: "sent", to: email.data };
}

// Already signed in with no role yet (the link was opened in another browser, say): no second email needed.
export async function continueAsPending(): Promise<void> {
  await requireSignedIn();
  const result = await continueClinicianSignup();
  if (result.kind !== "sent") redirect(result.kind === "mailto" ? "/" : "/start?door=clinician&problem=refused");
  (await cookies()).set(INTENT_COOKIE, result.intent, intentCookieOptions());
  redirect("/app/welcome");
}
