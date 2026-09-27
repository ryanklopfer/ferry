import { createHash, timingSafeEqual } from "node:crypto";
import { deployTier, type Env } from "./deploy";

// The phone spike's pages (/dev/*, /api/dev/*) need no sign-in, so they exist only in the dev tier and only for
// the per-run key k that `bun run dev:phone` generates and passes to next dev as FERRY_SPIKE_K. Anything else 404s.
const MIN_KEY_LENGTH = 32;

export function spikeKey(env: Env = process.env): string | null {
  const k = env.FERRY_SPIKE_K;
  if (!k || k.length < MIN_KEY_LENGTH) return null;
  try {
    return deployTier(env) === "dev" ? k : null;
  } catch {
    return null;
  }
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function spikeKeyValid(given: unknown, env: Env = process.env): given is string {
  const k = spikeKey(env);
  return !!k && typeof given === "string" && timingSafeEqual(digest(given), digest(k));
}

// Relay tokens carry devRun:<id>, so a capture opened in one dev:phone run can't be joined from another.
export const devRunId = (k: string) => digest(k).toString("base64url").slice(0, 16);

export const spikeManifestStartUrl = (k: string) => `/dev/mic?k=${encodeURIComponent(k)}`;
export const spikeManifestUrl = (k: string) => `/api/dev/manifest?k=${encodeURIComponent(k)}`;

// Behind dev:phone, Caddy serves the relay on the page's own origin; the e2e suite runs it on its own port.
export function relayUrlFor(captureId: string, env: Env = process.env): string {
  const path = `/ws/capture/${captureId}`;
  return env.FERRY_RELAY_URL ? `${env.FERRY_RELAY_URL.replace(/\/+$/, "")}${path}` : path;
}
