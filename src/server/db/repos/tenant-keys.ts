import { eq } from "drizzle-orm";
import type { ClinicianCtx, Ctx } from "@/server/auth/ctx";
import { type Keyring, keyringFrom, newTenantKey, type StoredTenantKey } from "@/server/crypto/tenant-keys";
import { db } from "../index";
import { tenantKeys } from "../schema";

// Reads tenant_keys. Lint (ferry/privileged-imports) limits this module to the repos, db/testing.ts and demo:seed, so
// nothing else can hold a tenant's key. A clinician's key is made with their role (usersRepo.changeRole).

async function stored(tenantId: string): Promise<StoredTenantKey | undefined> {
  const [row] = await db.select({ keyId: tenantKeys.keyId, kekRef: tenantKeys.kekRef, wrappedKey: tenantKeys.wrappedKey }).from(tenantKeys).where(eq(tenantKeys.userId, tenantId));
  return row;
}

// A ClientCtx carries its tenant's id, so a client reads its clinician's rows with the clinician's key. A tenant with
// no key row throws KeyUnavailable: keys are never made on first use.
export const keyringFor = async (ctx: Ctx): Promise<Keyring> => keyringFrom(ctx.userId, await stored(ctx.userId));

// For the test and demo helpers, which create clinicians without changing a role. A second call keeps the first key.
export const tenantKeysRepo = {
  async create(ctx: ClinicianCtx): Promise<void> {
    await db.insert(tenantKeys).values({ ...(await newTenantKey(ctx.userId)), userId: ctx.userId }).onConflictDoNothing();
  },
};
