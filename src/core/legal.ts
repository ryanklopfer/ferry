import { sha256Hex } from "./sha256";

// content/legal/<doc>.md: front matter, then paragraphs and "## " headings. A consent records the text's version and
// docHash; assertLiveLegal (src/server/legal.ts) refuses live use while a required text is still a placeholder.
export type LegalBlock = { kind: "heading" | "paragraph"; text: string };
export type LegalDoc = { title: string; version: string; placeholder: boolean; blocks: LegalBlock[] };

export class LegalFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalFormatError";
  }
}

export function parseLegal(source: string): LegalDoc {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new LegalFormatError("A legal text starts with front matter between --- lines");
  const meta = Object.fromEntries(match[1].split("\n").map((line) => {
    const at = line.indexOf(":");
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  }));
  if (!meta.title || !meta.version || !["true", "false"].includes(meta.placeholder)) throw new LegalFormatError("Front matter needs title, version and placeholder: true|false");
  const blocks = match[2]
    .split(/\n{2,}/)
    .map((b) => b.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean)
    .map((b): LegalBlock => (b.startsWith("## ") ? { kind: "heading", text: b.slice(3) } : { kind: "paragraph", text: b }));
  return { title: meta.title, version: meta.version, placeholder: meta.placeholder === "true", blocks };
}

export const CLINICIAN_DOC_TYPES = ["terms", "privacy", "baa", "npi_filing_authorization"] as const;
export const CLIENT_DOC_TYPES = ["client_filing", "client_recording"] as const;
export const CONSENT_DOC_TYPES = [...CLINICIAN_DOC_TYPES, ...CLIENT_DOC_TYPES] as const;
export type ClinicianDocType = (typeof CLINICIAN_DOC_TYPES)[number];
export type ClientDocType = (typeof CLIENT_DOC_TYPES)[number];
export type ConsentDocType = (typeof CONSENT_DOC_TYPES)[number];

// Who signed a client consent. A client under 18 needs a parent, guardian or legal representative (Q-L2).
export const SIGNER_RELATIONSHIPS = ["self", "parent_guardian", "legal_representative"] as const;
export type SignerRelationship = (typeof SIGNER_RELATIONSHIPS)[number];

export const LEGAL_SLUG: Record<ConsentDocType, string> = {
  terms: "terms",
  privacy: "privacy",
  baa: "baa",
  npi_filing_authorization: "npi-filing-authorization",
  client_filing: "client-filing",
  client_recording: "client-recording",
};

export const isClientDocType = (t: string): t is ClientDocType => (CLIENT_DOC_TYPES as readonly string[]).includes(t);
export const isClinicianDocType = (t: string): t is ClinicianDocType => (CLINICIAN_DOC_TYPES as readonly string[]).includes(t);

// The whole file, front matter included, so a version bump or a placeholder flip makes every earlier consent stale.
export const docHash = (source: string): string => sha256Hex(source.replace(/\r\n?/g, "\n"));

export type ConsentRecord = { docType: string; contentHash: string; createdAt: Date; withdrawnAt: Date | null };
export type ConsentState = "current" | "stale" | "none";

// The latest record not withdrawn decides: none without one, stale when it was signed to another text.
export function currentConsent(records: readonly ConsentRecord[], docType: ConsentDocType, liveHash: string): ConsentState {
  const latest = records.filter((r) => r.docType === docType && r.withdrawnAt === null).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!latest) return "none";
  return latest.contentHash === liveHash ? "current" : "stale";
}

// Whole years from an ISO date of birth to today's UTC date; null when the date isn't one.
export function ageOn(dob: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const born = new Date(Date.UTC(y, mo - 1, d));
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== mo - 1 || born.getUTCDate() !== d) return null;
  const [ty, tm, td] = [today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()];
  return ty - y - (tm < mo || (tm === mo && td < d) ? 1 : 0);
}

// The calendar date it still is somewhere in the US at this instant (American Samoa, UTC-11, no daylight time). A
// birthday counts only once it has arrived everywhere, so no one turns 18 early by being east of their clinician.
export const earliestUsDate = (now: Date): Date => new Date(now.getTime() - 11 * 3_600_000);
