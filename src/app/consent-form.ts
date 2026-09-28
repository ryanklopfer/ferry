import { z } from "zod";
import { CONSENT_DOC_TYPES, SIGNER_RELATIONSHIPS } from "@/core/legal";
import type { ConsentRefusal } from "@/server/errors";
import type { ConsentInput } from "@/server/services/consents";

const SELF = "http://self.invalid";

// Where an interstitial returns to: a path on this site, never another origin or the interstitial itself. The value is
// parsed the way a browser would read the Location header (which drops tabs and newlines, so "/\t/x" is "//x").
export function safeNext(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  let u: URL;
  try {
    u = new URL(value, SELF);
  } catch {
    return fallback;
  }
  if (u.origin !== SELF || /\/reconsent\/?$/.test(u.pathname)) return fallback;
  return u.pathname + u.search + u.hash;
}

const Signed = z.object({ docType: z.enum(CONSENT_DOC_TYPES), shownHash: z.string().regex(/^[0-9a-f]{64}$/) });

// The re-consent form: one hidden "doc" field per text ("<docType>:<hash>"), a typed name, and for clients who is signing.
export function consentInputs(fd: FormData, h: Headers): ConsentInput[] {
  const signer = z.enum(SIGNER_RELATIONSHIPS).safeParse(fd.get("signer"));
  const typedName = String(fd.get("typedName") ?? "").slice(0, 200);
  // One trusted hop (the load balancer, S21a) appends the address it saw; entries to its left are the caller's own
  // claims. With no proxy, Next sets the header to the socket address only when the caller didn't send one.
  const ip = (h.get("x-forwarded-for")?.split(",").at(-1) ?? "").trim().slice(0, 64) || null;
  const userAgent = h.get("user-agent")?.slice(0, 512) || null;
  return fd.getAll("doc").flatMap((v) => {
    const [docType, shownHash] = String(v).split(":");
    const parsed = Signed.safeParse({ docType, shownHash });
    return parsed.success ? [{ ...parsed.data, typedName, signerRelationship: signer.success ? signer.data : undefined, ip, userAgent }] : [];
  });
}

const PROBLEMS = ["wrong_party", "minor_self", "text_changed", "no_name", "no_signer"] as const satisfies readonly ConsentRefusal[];

export const problemParam = (value: unknown): ConsentRefusal | undefined => PROBLEMS.find((p) => p === value);
