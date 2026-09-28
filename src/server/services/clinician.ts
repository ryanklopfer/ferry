import { type Address, type BillingParty, billingParty, liveFilingAllowed, type Modality, type NoteFormat, type NpiType, ProfileInput, type TaxIdType } from "@/core/clinician";
import type { OnboardingProblem } from "@/core/copy/onboarding";
import type { LegalBlock } from "@/core/legal";
import { COMMON_BEHAVIORAL_CODES, dollarsToCents, type FeeItem, isBehavioralCode } from "@/core/fee-schedule";
import type { SignupDecision } from "@/core/signup";
import { auth } from "@/server/auth";
import { type ClinicianCtx, type ClinicianOnlyCtx, getClinician, getSessionUser } from "@/server/auth/ctx";
import { signIntent, verifyIntent } from "@/server/auth/intent";
import { clinicianProfilesRepo, NpiTaken, type ProfilePatch } from "@/server/db/repos/clinician-profiles";
import { feeScheduleRepo } from "@/server/db/repos/fee-schedule";
import { resolvers } from "@/server/db/repos/resolvers";
import { deployTier } from "@/server/deploy";
import { ConsentRefused } from "@/server/errors";
import { assertLiveLegal, liveText } from "@/server/legal";
import { log } from "@/server/log";
import { signupPolicy } from "@/server/signup";
import { consentStatus, recordConsent, recordConsents } from "./consents";
import { setRoleOnServer } from "./roles";

export type SignupRefusal = "signed_out" | "no_intent" | "other_role";

export class SignupRefused extends Error {
  constructor(readonly reason: SignupRefusal) {
    super(`Sign-up refused: ${reason}`);
    this.name = "SignupRefused";
  }
}

// A profile or fee input the clinician can fix; `fields` names the inputs to highlight.
export class ProfileRefused extends Error {
  constructor(
    readonly reason: OnboardingProblem,
    readonly fields: string[] = [],
  ) {
    super(`Profile refused: ${reason}`);
    this.name = "ProfileRefused";
  }
}

// ---- Sign-up ----

export type StartResult = { kind: "sent"; intent: string } | Exclude<SignupDecision, { kind: "open" }>;

// Start free's clinician door: if the policy admits this email, email a magic link that lands on onboarding and hand
// back the intent the action sets as an httpOnly cookie. Nothing else from the form is read.
export async function startClinicianSignup(email: string, requestHeaders: Headers): Promise<StartResult> {
  const decision = signupPolicy(email);
  if (decision.kind !== "open") return decision;
  await auth.api.signInMagicLink({ body: { email, callbackURL: "/app/welcome", errorCallbackURL: "/start?door=clinician&problem=link" }, headers: requestHeaders });
  return { kind: "sent", intent: signIntent(email) };
}

// Already signed in with a verified email and no role: no link needed, just the intent for that email.
export async function continueClinicianSignup(): Promise<StartResult> {
  const user = await getSessionUser();
  if (!user) throw new SignupRefused("signed_out");
  if (user.role !== "pending") throw new SignupRefused("other_role");
  const decision = signupPolicy(user.email);
  return decision.kind === "open" ? { kind: "sent", intent: signIntent(user.email) } : decision;
}

export async function signupIntentValid(intent: string | undefined): Promise<boolean> {
  const user = await getSessionUser();
  return !!user && user.role === "pending" && verifyIntent(intent, user.email) && signupPolicy(user.email).kind === "open";
}

export type Agreement = { typedName: string; shown: { terms: string; baa: string }; ip: string | null; userAgent: string | null };

const AGREEMENT = ["terms", "baa"] as const;

// The only path to the clinician role: a signed-in pending user holding a valid intent for their own email. It sets
// the role on the server, then records the terms and BAA they were shown. A role in the request, a missing or
// tampered cookie, or a user who already has another role changes nothing.
export async function completeClinicianSignup(intent: string | undefined, agreement: Agreement): Promise<ClinicianCtx> {
  const user = await getSessionUser();
  if (!user) throw new SignupRefused("signed_out");
  if (user.role !== "pending" && user.role !== "clinician") throw new SignupRefused("other_role");
  if (user.role === "pending" && (!verifyIntent(intent, user.email) || signupPolicy(user.email).kind !== "open")) throw new SignupRefused("no_intent");
  if (deployTier() === "prod") await assertLiveLegal(AGREEMENT);
  // Checked before the role changes, so a refused signature leaves the user pending.
  if (!agreement.typedName.trim()) throw new ConsentRefused("no_name");
  for (const t of AGREEMENT) if ((await liveText(t)).hash !== agreement.shown[t]) throw new ConsentRefused("text_changed");

  if (user.role === "pending") await setRoleOnServer(user.userId, "clinician");
  const ctx = await getClinician();
  if (typeof ctx === "number") throw new SignupRefused("other_role");
  await recordConsents(
    ctx,
    AGREEMENT.map((docType) => ({ docType, typedName: agreement.typedName, shownHash: agreement.shown[docType], ip: agreement.ip, userAgent: agreement.userAgent })),
  );
  log("clinician.signed_up", { userId: ctx.userId });
  return ctx;
}

export type LegalTextView = { docType: "terms" | "baa" | "npi_filing_authorization"; title: string; version: string; placeholder: boolean; blocks: LegalBlock[]; hash: string };

// The texts a step shows, with the hash its form sends back so a text that changes mid-signing is refused.
export async function legalTexts<T extends LegalTextView["docType"]>(docTypes: readonly T[]): Promise<(LegalTextView & { docType: T })[]> {
  return Promise.all(
    docTypes.map(async (docType) => {
      const { doc, hash } = await liveText(docType);
      return { docType, title: doc.title, version: doc.version, placeholder: doc.placeholder, blocks: doc.blocks, hash };
    }),
  );
}

// ---- Onboarding ----

export type OnboardingStep = "agree" | "practice" | "fees" | "authorize" | "done";

export async function onboardingStep(ctx: ClinicianCtx): Promise<OnboardingStep> {
  const [consents, profile, fees] = await Promise.all([consentStatus(ctx), clinicianProfilesRepo.get(ctx), feeScheduleRepo.list(ctx)]);
  if (consents.terms !== "current" || consents.baa !== "current") return "agree";
  if (profile?.onboardedAt) return "done";
  if (!profile) return "practice";
  if (!fees.length) return "fees";
  return "authorize";
}

export type ProfileView = {
  legalName: string;
  credential: string;
  npi: string;
  npiType: NpiType;
  groupName: string | null;
  groupNpi: string | null;
  taxIdType: TaxIdType;
  taxIdLast4: string | null;
  practiceAddress: Address;
  licenseState: string;
  licenseNumber: string;
  taxonomyCode: string;
  defaultNoteFormat: NoteFormat;
  defaultModality: Modality;
  onboarded: boolean;
};

// Field by field: the Tax ID itself never leaves the service, only its last four.
export async function profileView(ctx: ClinicianCtx): Promise<ProfileView | null> {
  const p = await clinicianProfilesRepo.get(ctx);
  if (!p) return null;
  return {
    legalName: p.legalName,
    credential: p.credential,
    npi: p.npi,
    npiType: p.npiType,
    groupName: p.groupName,
    groupNpi: p.groupNpi,
    taxIdType: p.taxIdType,
    taxIdLast4: p.taxIdLast4,
    practiceAddress: p.practiceAddress,
    licenseState: p.licenseState,
    licenseNumber: p.licenseNumber,
    taxonomyCode: p.taxonomyCode,
    defaultNoteFormat: p.defaultNoteFormat,
    defaultModality: p.defaultModality,
    onboarded: p.onboardedAt !== null,
  };
}

const PROBLEM_CODES = new Set<string>(["npi_format", "npi_check", "group_name_required", "group_npi_check", "group_npi_same", "group_needs_ein", "tax_id_format", "zip_format"]);

export async function saveProfile(ctx: ClinicianCtx, raw: unknown): Promise<void> {
  // The NPI's check digit is part of the parse, so a mistyped NPI is refused before any lookup.
  const parsed = ProfileInput.safeParse(raw);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    const known = parsed.error.issues.map((i) => i.message).find((m) => PROBLEM_CODES.has(m));
    throw new ProfileRefused((known as OnboardingProblem | undefined) ?? "invalid", fields);
  }
  const { taxId, address, ...rest } = parsed.data;
  const owner = await resolvers.profileOwnerByNpi(rest.npi);
  if (owner && owner !== ctx.userId) throw new ProfileRefused("npi_taken", ["npi"]);

  const existing = await clinicianProfilesRepo.get(ctx);
  const values = { ...rest, practiceAddress: address };
  try {
    if (!existing) {
      if (!taxId) throw new ProfileRefused("tax_id_required", ["taxId"]);
      await clinicianProfilesRepo.create(ctx, { ...values, taxId });
    } else {
      const patch: ProfilePatch = { ...values, ...(taxId ? { taxId } : {}) };
      // A new NPI or name has not been checked against NPPES or by a person (S6).
      if (rest.npi !== existing.npi || rest.legalName !== existing.legalName) Object.assign(patch, { nppesCheckedAt: null, nppesNameMatch: null, identityVerifiedAt: null });
      await clinicianProfilesRepo.update(ctx, existing.id, patch);
    }
  } catch (e) {
    if (e instanceof NpiTaken) throw new ProfileRefused("npi_taken", ["npi"]);
    throw e;
  }
  log("clinician.profile_saved", { userId: ctx.userId });
}

export async function feesView(ctx: ClinicianCtx): Promise<FeeItem[]> {
  return feeScheduleRepo.list(ctx);
}

// Dollar amounts from the fee form, by code. A blank amount means no fee for that code.
export async function setFees(ctx: ClinicianCtx, entries: readonly { cptCode: string; amount: string }[]): Promise<void> {
  const items: FeeItem[] = [];
  for (const { cptCode, amount } of entries) {
    if (!amount.trim()) continue;
    if (!isBehavioralCode(cptCode)) throw new ProfileRefused("invalid", [cptCode]);
    const cents = dollarsToCents(amount);
    if (!cents) throw new ProfileRefused("fee_format", [cptCode]);
    items.push({ cptCode, chargeCents: cents });
  }
  if (!items.length) throw new ProfileRefused("no_fees", COMMON_BEHAVIORAL_CODES.map((c) => c.code));
  await feeScheduleRepo.replace(ctx, items);
  log("clinician.fees_saved", { userId: ctx.userId, count: items.length });
}

export type Signature = { typedName: string; shownHash: string; ip: string | null; userAgent: string | null };

// The typed signature on npi_filing_authorization: the consent row keeps the name, time, IP, user agent and the hash
// of the text signed.
export async function authorizeFiling(ctx: ClinicianCtx, signature: Signature): Promise<void> {
  await recordConsent(ctx, { docType: "npi_filing_authorization", ...signature });
}

export async function completeOnboarding(ctx: ClinicianCtx): Promise<void> {
  const [step, consents] = await Promise.all([onboardingStep(ctx), consentStatus(ctx)]);
  if (step === "done") return;
  if (step !== "authorize" || consents.npi_filing_authorization !== "current") throw new ProfileRefused("incomplete");
  if (deployTier() === "prod") await assertLiveLegal(AGREEMENT);
  await clinicianProfilesRepo.markOnboarded(ctx, new Date());
  log("clinician.onboarded", { userId: ctx.userId });
}

// What a claim takes from the clinician: who bills and renders, the fee schedule as it stands now, and whether live
// filing is allowed under this NPI yet.
export async function profileForClaims(ctx: ClinicianOnlyCtx): Promise<{ party: BillingParty; fees: FeeItem[]; liveFilingAllowed: boolean } | null> {
  const [profile, fees, authorization] = await Promise.all([clinicianProfilesRepo.get(ctx), feeScheduleRepo.list(ctx), liveText("npi_filing_authorization")]);
  if (!profile) return null;
  return {
    party: billingParty(profile),
    fees,
    liveFilingAllowed: liveFilingAllowed(profile, { authorizationPlaceholder: authorization.doc.placeholder }),
  };
}
