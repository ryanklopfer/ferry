import { createHmac } from "node:crypto";

// Blind indexes: HMAC-SHA256 under the tenant's index key (never its data key), over a normalized value,
// so an equality lookup needs no decryption and the index alone reveals nothing.
export const NORMALIZERS = {
  email: (v: string) => v.trim().toLowerCase(),
  phone: (v: string) => v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""),
  memberId: (v: string) => v.replace(/[\s-]/g, "").toUpperCase(),
  taxId: (v: string) => v.replace(/\D/g, ""),
} as const;
export type Normalizer = keyof typeof NORMALIZERS;

export function blindIndex(indexKey: Buffer, purpose: string, normalizer: Normalizer, value: string): string {
  if (indexKey.length !== 32) throw new Error("An index key is 32 bytes");
  return createHmac("sha256", indexKey).update(`${purpose}\0${NORMALIZERS[normalizer](value)}`).digest("base64url");
}
