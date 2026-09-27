import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CaptureId } from "@/core/capture/protocol";
import type { Env } from "@/server/deploy";

// A relay token lets one browser stream audio for one capture for 60 seconds. The subject is the
// tenant (from N12) or devRun:<id> for the phone spike; a capture never changes subject.
export const TOKEN_TTL_MS = 60_000;

const Claims = z.strictObject({ captureId: CaptureId, subject: z.string().regex(/^[A-Za-z0-9_:-]{1,100}$/), exp: z.int() });
export type RelayClaims = z.infer<typeof Claims>;

export type Verified = { ok: true; claims: RelayClaims } | { ok: false; code: "token_missing" | "token_invalid" | "token_expired" };

export class RelaySecretMissing extends Error {
  constructor() {
    super("RELAY_SECRET must be set to at least 32 characters (openssl rand -base64 32)");
    this.name = "RelaySecretMissing";
  }
}

export function relaySecret(env: Env = process.env): string {
  const secret = env.RELAY_SECRET;
  if (!secret || secret.length < 32) throw new RelaySecretMissing();
  return secret;
}

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function issueRelayToken(binding: { captureId: string; subject: string }, secret: string, now: number): string {
  const payload = Buffer.from(JSON.stringify(Claims.parse({ ...binding, exp: now + TOKEN_TTL_MS }))).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyRelayToken(token: string | null | undefined, secret: string, now: number): Verified {
  if (!token) return { ok: false, code: "token_missing" };
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length) return { ok: false, code: "token_invalid" };
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, code: "token_invalid" };
  let claims: RelayClaims;
  try {
    claims = Claims.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    return { ok: false, code: "token_invalid" };
  }
  if (claims.exp - now > TOKEN_TTL_MS) return { ok: false, code: "token_invalid" };
  if (now > claims.exp) return { ok: false, code: "token_expired" };
  return { ok: true, claims };
}
