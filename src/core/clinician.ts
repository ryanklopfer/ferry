import { z } from "zod";
import { isValidNpi } from "./npi";

export const TAX_ID_TYPES = ["EIN", "SSN"] as const;
export type TaxIdType = (typeof TAX_ID_TYPES)[number];

// Which NPI claims bill under: the clinician's own NPI-1, or their group's NPI-2 (with the NPI-1 as rendering provider).
export const NPI_TYPES = ["individual", "group"] as const;
export type NpiType = (typeof NPI_TYPES)[number];

export const NOTE_FORMATS = ["soap", "dap", "birp", "intake"] as const;
export type NoteFormat = (typeof NOTE_FORMATS)[number];
export const NOTE_FORMAT_LABELS: Record<NoteFormat, string> = { soap: "SOAP", dap: "DAP", birp: "BIRP", intake: "Intake" };

export const MODALITIES = ["in_person", "telehealth"] as const;
export type Modality = (typeof MODALITIES)[number];
export const MODALITY_LABELS: Record<Modality, string> = { in_person: "In person", telehealth: "Telehealth" };

// Behavioral-health taxonomy codes (NUCC code set); the labels are our own words.
export const BEHAVIORAL_TAXONOMIES = [
  { code: "1041C0700X", label: "Clinical social worker" },
  { code: "106H00000X", label: "Marriage and family therapist" },
  { code: "101YP2500X", label: "Professional counselor" },
  { code: "101YM0800X", label: "Mental health counselor" },
  { code: "103TC0700X", label: "Clinical psychologist" },
  { code: "103T00000X", label: "Psychologist" },
  { code: "2084P0800X", label: "Psychiatrist" },
  { code: "363LP0808X", label: "Psychiatric nurse practitioner" },
] as const;
export type TaxonomyCode = (typeof BEHAVIORAL_TAXONOMIES)[number]["code"];
const TAXONOMY_CODES = BEHAVIORAL_TAXONOMIES.map((t) => t.code) as [TaxonomyCode, ...TaxonomyCode[]];

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

export type Address = { line1: string; line2: string | null; city: string; state: string; zip: string };

// The Tax ID is kept as its nine digits; EIN and SSN differ only in how they're shown.
export const taxIdDigits = (value: string): string => value.replace(/\D/g, "");

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

// Codes are the problem keys in src/core/copy/onboarding.ts.
export const ProfileInput = z
  .object({
    legalName: text(120),
    credential: text(20),
    npi: z.string().trim().regex(/^\d{10}$/, "npi_format").refine(isValidNpi, "npi_check"),
    npiType: z.enum(NPI_TYPES),
    groupName: optionalText(120),
    groupNpi: optionalText(10),
    taxIdType: z.enum(TAX_ID_TYPES),
    // Empty on an edit keeps the Tax ID on file; the service requires one the first time.
    taxId: z
      .string()
      .trim()
      .transform(taxIdDigits)
      .refine((v) => v === "" || v.length === 9, "tax_id_format"),
    address: z.object({ line1: text(120), line2: optionalText(120), city: text(80), state: z.enum(US_STATES), zip: z.string().trim().regex(/^\d{5}(-?\d{4})?$/, "zip_format") }),
    licenseState: z.enum(US_STATES),
    licenseNumber: text(40),
    taxonomyCode: z.enum(TAXONOMY_CODES),
    defaultNoteFormat: z.enum(NOTE_FORMATS),
    defaultModality: z.enum(MODALITIES),
  })
  .superRefine((p, ctx) => {
    if (p.npiType !== "group") return;
    if (!p.groupName) ctx.addIssue({ code: "custom", path: ["groupName"], message: "group_name_required" });
    if (!p.groupNpi || !/^\d{10}$/.test(p.groupNpi) || !isValidNpi(p.groupNpi)) ctx.addIssue({ code: "custom", path: ["groupNpi"], message: "group_npi_check" });
    else if (p.groupNpi === p.npi) ctx.addIssue({ code: "custom", path: ["groupNpi"], message: "group_npi_same" });
    if (p.taxIdType !== "EIN") ctx.addIssue({ code: "custom", path: ["taxIdType"], message: "group_needs_ein" });
  })
  .transform((p) => (p.npiType === "group" ? p : { ...p, groupName: null, groupNpi: null }));
export type ProfileInput = z.output<typeof ProfileInput>;

export type BillingProfile = {
  legalName: string;
  credential: string;
  npi: string;
  npiType: NpiType;
  groupName: string | null;
  groupNpi: string | null;
  taxId: string;
  taxIdType: TaxIdType;
  practiceAddress: Address;
  taxonomyCode: string;
};

export type BillingParty = {
  billing: { entity: "person" | "organization"; name: string; npi: string; taxId: string; taxIdType: TaxIdType; address: Address; taxonomyCode: string };
  rendering: { name: string; credential: string; npi: string; taxonomyCode: string };
};

export class BillingPartyError extends Error {
  constructor(readonly reason: "group_incomplete" | "group_needs_ein") {
    super(`No billing party: ${reason}`);
    this.name = "BillingPartyError";
  }
}

// Who bills and who renders on every claim. Solo: the clinician's NPI-1 does both. Group: the group's NPI-2 and EIN
// bill, and the clinician's NPI-1 renders.
export function billingParty(p: BillingProfile): BillingParty {
  const rendering = { name: p.legalName, credential: p.credential, npi: p.npi, taxonomyCode: p.taxonomyCode };
  const common = { taxId: p.taxId, taxIdType: p.taxIdType, address: p.practiceAddress, taxonomyCode: p.taxonomyCode };
  if (p.npiType === "individual") return { billing: { entity: "person", name: p.legalName, npi: p.npi, ...common }, rendering };
  if (!p.groupNpi || !p.groupName) throw new BillingPartyError("group_incomplete");
  if (p.taxIdType !== "EIN") throw new BillingPartyError("group_needs_ein");
  return { billing: { entity: "organization", name: p.groupName, npi: p.groupNpi, ...common }, rendering };
}

// Ferry files live claims under this NPI only once the NPPES name matched, a person checked their identity
// (identity:verify, S6), and the attorney's authorization text replaced the placeholder (F4).
export function liveFilingAllowed(profile: { nppesNameMatch: boolean | null; identityVerifiedAt: Date | null }, legal: { authorizationPlaceholder: boolean }): boolean {
  return profile.nppesNameMatch === true && profile.identityVerifiedAt !== null && !legal.authorizationPlaceholder;
}
