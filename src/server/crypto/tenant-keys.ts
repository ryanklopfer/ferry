import { randomBytes } from "node:crypto";
import type { DataKey } from "./aead";
import { keyProvider } from "./index";
import { KeyUnavailable } from "./key-provider";

// A tenant's data key seals its rows; its index key (separate, per the blind-index rule) computes blind indexes.
// The tenant_keys rows themselves are read and written only by src/server/db/repos/tenant-keys.ts.
export type Keyring = { tenantId: string; data: DataKey; index: Buffer };
export type StoredTenantKey = { keyId: string; kekRef: string; wrappedKey: string };

// 64 fresh bytes (data key, then index key), wrapped for this tenant. Nothing is stored here.
export async function newTenantKey(tenantId: string): Promise<StoredTenantKey> {
  const { kekRef, wrapped } = await keyProvider().wrap(randomBytes(64), { tenantId });
  return { keyId: `t-${randomBytes(8).toString("hex")}`, kekRef, wrappedKey: wrapped };
}

// Unwrapping is the expensive call (KMS in AWS), so each tenant's unwrapped key is cached against the wrapped form it
// came from. The caller passes the row it just read: a replaced key replaces the entry, and a missing row (a key
// never made, or destroyed after retention) evicts it and throws rather than making a new key.
const unwrapped = new Map<string, { wrappedKey: string; material: Buffer }>();

export async function keyringFrom(tenantId: string, stored: StoredTenantKey | undefined): Promise<Keyring> {
  if (!stored) {
    unwrapped.delete(tenantId);
    throw new KeyUnavailable("This tenant has no key");
  }
  let cached = unwrapped.get(tenantId);
  if (cached?.wrappedKey !== stored.wrappedKey) {
    cached = { wrappedKey: stored.wrappedKey, material: await keyProvider().unwrap({ kekRef: stored.kekRef, wrapped: stored.wrappedKey }, { tenantId }) };
    unwrapped.set(tenantId, cached);
  }
  return { tenantId, data: { id: stored.keyId, bytes: cached.material.subarray(0, 32) }, index: cached.material.subarray(32, 64) };
}
