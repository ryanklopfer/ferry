import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Ctx } from "@/server/auth/ctx";
import { db } from "@/server/db";
import { tenantKeys } from "@/server/db/schema";
import type { DataKey } from "./aead";
import { keyProvider } from "./index";

// A tenant's data key seals its rows; its index key (separate, per the blind-index rule) computes blind indexes.
export type Keyring = { tenantId: string; data: DataKey; index: Buffer };

// Unwrapping is the expensive call (KMS in AWS), so unwrapped keys are cached by their wrapped form. The row is
// read every time, so a deleted or replaced key is never served from the cache.
const unwrapped = new Map<string, Buffer>();

async function load(tenantId: string): Promise<{ keyId: string; kekRef: string; wrappedKey: string } | undefined> {
  const [row] = await db.select({ keyId: tenantKeys.keyId, kekRef: tenantKeys.kekRef, wrappedKey: tenantKeys.wrappedKey }).from(tenantKeys).where(eq(tenantKeys.userId, tenantId));
  return row;
}

// Created on first use. Two racing first uses both insert; the unique user_id keeps one and both read it back.
export async function tenantKeyring(tenantId: string): Promise<Keyring> {
  let row = await load(tenantId);
  if (!row) {
    const material = randomBytes(64);
    const { kekRef, wrapped } = await keyProvider().wrap(material, { tenantId });
    await db.insert(tenantKeys).values({ keyId: `t-${randomBytes(8).toString("hex")}`, userId: tenantId, kekRef, wrappedKey: wrapped }).onConflictDoNothing();
    row = await load(tenantId);
    if (!row) throw new Error("tenant key was not stored");
  }
  const cacheKey = `${tenantId}.${row.wrappedKey}`;
  let material = unwrapped.get(cacheKey);
  if (!material) {
    material = await keyProvider().unwrap({ kekRef: row.kekRef, wrapped: row.wrappedKey }, { tenantId });
    unwrapped.set(cacheKey, material);
  }
  return { tenantId, data: { id: row.keyId, bytes: material.subarray(0, 32) }, index: material.subarray(32, 64) };
}

// A ClientCtx carries its tenant's id, so a client reads its clinician's rows with the clinician's key.
export const keyringFor = (ctx: Ctx): Promise<Keyring> => tenantKeyring(ctx.userId);
