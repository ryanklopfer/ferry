import { isOnboardingProblem, type OnboardingProblem } from "@/core/copy/onboarding";
import { ConsentRefused } from "@/server/errors";
import { LegalPlaceholder } from "@/server/legal";
import { ProfileRefused, type ProfileView, SignupRefused } from "@/server/services/clinician";
import type { FormState } from "@/ui/onboarding/form-state";

export type { FormState };

export const PROFILE_FIELDS = [
  "legalName",
  "credential",
  "npi",
  "npiType",
  "groupName",
  "groupNpi",
  "taxIdType",
  "taxId",
  "line1",
  "line2",
  "city",
  "state",
  "zip",
  "licenseState",
  "licenseNumber",
  "taxonomyCode",
  "defaultNoteFormat",
  "defaultModality",
] as const;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").slice(0, 200);

export const formValues = (fd: FormData, keys: readonly string[]): Record<string, string> => Object.fromEntries(keys.map((k) => [k, str(fd, k)]));

// The practice form, shaped for ProfileInput. The Tax ID is never echoed back into the form.
export function profileInput(fd: FormData) {
  const v = formValues(fd, PROFILE_FIELDS);
  return {
    ...v,
    address: { line1: v.line1, line2: v.line2, city: v.city, state: v.state, zip: v.zip },
  };
}

export const FEE_PREFIX = "fee:";

export function feeEntries(fd: FormData): { cptCode: string; amount: string }[] {
  return [...fd.keys()].filter((k) => k.startsWith(FEE_PREFIX)).map((k) => ({ cptCode: k.slice(FEE_PREFIX.length), amount: str(fd, k) }));
}

// The plain-copy key for a refusal the clinician can act on; anything else is rethrown.
export function problemOf(e: unknown): OnboardingProblem | null {
  if (e instanceof ProfileRefused || e instanceof SignupRefused || e instanceof ConsentRefused) return isOnboardingProblem(e.reason) ? e.reason : "invalid";
  if (e instanceof LegalPlaceholder) return "legal_placeholder";
  return null;
}

export const refusedState = (e: unknown, values: Record<string, string>): FormState | null => {
  const problem = problemOf(e);
  if (!problem) return null;
  const fields = e instanceof ProfileRefused ? e.fields : [];
  return { problem, fields, values: { ...values, taxId: "" } };
};

// The saved profile as form defaults. The Tax ID is never among them.
export function profileFormValues(p: ProfileView | null): Record<string, string> {
  if (!p) return {};
  return {
    legalName: p.legalName,
    credential: p.credential,
    npi: p.npi,
    npiType: p.npiType,
    groupName: p.groupName ?? "",
    groupNpi: p.groupNpi ?? "",
    taxIdType: p.taxIdType,
    line1: p.practiceAddress.line1,
    line2: p.practiceAddress.line2 ?? "",
    city: p.practiceAddress.city,
    state: p.practiceAddress.state,
    zip: p.practiceAddress.zip,
    licenseState: p.licenseState,
    licenseNumber: p.licenseNumber,
    taxonomyCode: p.taxonomyCode,
    defaultNoteFormat: p.defaultNoteFormat,
    defaultModality: p.defaultModality,
  };
}
