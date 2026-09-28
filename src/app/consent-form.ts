import { z } from "zod";
import { CONSENT_DOC_TYPES, SIGNER_RELATIONSHIPS } from "@/core/legal";
import type { ConsentRefusal } from "@/server/errors";
import type { ConsentInput } from "@/server/services/consents";

// Where an interstitial returns to: a path on this site, never another origin or the interstitial itself.
export function safeNext(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /\/reconsent(\?|$)/.test(value)) return fallback;
  return value;
}

const Signed = z.object({ docType: z.enum(CONSENT_DOC_TYPES), shownHash: z.string().regex(/^[0-9a-f]{64}$/) });

// The re-consent form: one hidden "doc" field per text ("<docType>:<hash>"), a typed name, and for clients who is signing.
export function consentInputs(fd: FormData, h: Headers): ConsentInput[] {
  const signer = z.enum(SIGNER_RELATIONSHIPS).safeParse(fd.get("signer"));
  const typedName = String(fd.get("typedName") ?? "").slice(0, 200);
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim().slice(0, 64) || null;
  const userAgent = h.get("user-agent")?.slice(0, 512) || null;
  return fd.getAll("doc").flatMap((v) => {
    const [docType, shownHash] = String(v).split(":");
    const parsed = Signed.safeParse({ docType, shownHash });
    return parsed.success ? [{ ...parsed.data, typedName, signerRelationship: signer.success ? signer.data : undefined, ip, userAgent }] : [];
  });
}

const PROBLEMS = ["wrong_party", "minor_self", "text_changed", "no_name", "no_signer"] as const satisfies readonly ConsentRefusal[];

export const problemParam = (value: unknown): ConsentRefusal | undefined => PROBLEMS.find((p) => p === value);
