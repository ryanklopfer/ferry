import { randomBytes } from "node:crypto";

export const ID_PREFIXES = ["cli", "mbr", "pln", "prv", "clm", "lin", "doc", "fup", "evt", "ccn", "kcn"] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// ULID: 48 bits of milliseconds then 80 random bits, in Crockford base32, so ids sort by creation time.
function ulid(now = Date.now()): string {
  let time = "";
  for (let i = 0, t = now; i < 10; i++, t = Math.floor(t / 32)) time = ALPHABET[t % 32] + time;
  const bytes = randomBytes(16);
  let random = "";
  for (let i = 0; i < 16; i++) random += ALPHABET[bytes[i] % 32];
  return time + random;
}

export function newId(prefix: IdPrefix): string {
  if (!ID_PREFIXES.includes(prefix)) throw new Error(`Unknown id prefix: ${prefix}`);
  return `${prefix}_${ulid()}`;
}
