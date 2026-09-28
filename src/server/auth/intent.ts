import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "@/core/signup";
import { deployTier } from "@/server/deploy";

// Start free's clinician door sets this cookie; completeClinicianSignup (services/clinician.ts) makes a clinician only
// from a valid one. It is httpOnly, signed under a key derived from the auth secret, bound to the hash of the email
// the magic link went to, and short-lived. Nothing the browser sends in a form can stand in for it.
export const INTENT_COOKIE = "ferry_signup_intent";
export const INTENT_TTL_SECONDS = 60 * 60;

type Payload = { v: 1; intent: "clinician"; email: string; exp: number };

function key(): Buffer {
  const secret = process.env.VITEST ? "test-only-secret-never-used-outside-vitest" : process.env.BETTER_AUTH_SECRET;
  if (!secret && deployTier() !== "dev") throw new Error("BETTER_AUTH_SECRET is not set");
  return createHmac("sha256", secret || "dev-only-signup-intent-secret").update("ferry.signup-intent.v1").digest();
}

const emailHash = (email: string) => createHash("sha256").update(normalizeEmail(email)).digest("base64url");
const sign = (body: string) => createHmac("sha256", key()).update(body).digest("base64url");

export function signIntent(email: string, now: Date = new Date()): string {
  const payload: Payload = { v: 1, intent: "clinician", email: emailHash(email), exp: Math.floor(now.getTime() / 1000) + INTENT_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyIntent(value: string | undefined, email: string, now: Date = new Date()): boolean {
  if (!value) return false;
  const [body, mac, extra] = value.split(".");
  if (!body || !mac || extra !== undefined) return false;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  let payload: Partial<Payload>;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  return payload.v === 1 && payload.intent === "clinician" && payload.email === emailHash(email) && typeof payload.exp === "number" && payload.exp * 1000 > now.getTime();
}

export const intentCookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: deployTier() !== "dev", path: "/", maxAge: INTENT_TTL_SECONDS });
