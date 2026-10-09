// The codes a behavioral-health clinician sets a fee for at onboarding. The descriptions are our own short words,
// never the AMA's CPT descriptor text.
export const COMMON_BEHAVIORAL_CODES = [
  { code: "90791", label: "Intake assessment" },
  { code: "90792", label: "Intake assessment with medical services" },
  { code: "90832", label: "Therapy, about 30 minutes" },
  { code: "90834", label: "Therapy, about 45 minutes" },
  { code: "90837", label: "Therapy, about 60 minutes" },
  { code: "90846", label: "Family therapy, client not present" },
  { code: "90847", label: "Family therapy, client present" },
  { code: "90853", label: "Group therapy" },
  { code: "90839", label: "Crisis therapy, first hour" },
  { code: "90840", label: "Crisis therapy, each added half hour" },
  { code: "99213", label: "Medication visit, low complexity" },
  { code: "99214", label: "Medication visit, moderate complexity" },
  { code: "99215", label: "Medication visit, high complexity" },
  { code: "90833", label: "Therapy add-on to a medication visit, about 30 minutes" },
  { code: "90836", label: "Therapy add-on to a medication visit, about 45 minutes" },
  { code: "90838", label: "Therapy add-on to a medication visit, about 60 minutes" },
] as const;
export type BehavioralCode = (typeof COMMON_BEHAVIORAL_CODES)[number]["code"];

export const isBehavioralCode = (code: string): code is BehavioralCode => COMMON_BEHAVIORAL_CODES.some((c) => c.code === code);

export type FeeItem = { cptCode: string; chargeCents: number };

// No behavioral-health session costs more than this; anything above is a typo (and would overflow charge_cents).
export const MAX_FEE_CENTS = 100_000_00;

// The clinician's charge for a code, in cents, as the schedule stands when a claim is built. Claims copy it onto the
// line, so a later fee edit changes only claims built after it.
export function chargeFor(schedule: readonly FeeItem[], cptCode: string): number | { missing: string } {
  const item = schedule.find((f) => f.cptCode === cptCode);
  return item ? item.chargeCents : { missing: cptCode };
}

// "175", "175.5", "$1,175.00" → cents; anything else (blank, negative, more than two decimals) → null.
export function dollarsToCents(input: string): number | null {
  const m = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  return Number(m[1].replace(/,/g, "")) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export const centsToDollars = (cents: number): string => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
