import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { keyringFor } from "@/server/crypto/tenant-keys";
import { db } from "../index";
import { decodeRow, decodeRows, encodeRow } from "../codec";
import { newId } from "../ids";
import { type Provider, providers } from "../schema";
import { assertNotClient, tenantWhere } from "./scope";

export type ProviderValues = Omit<typeof providers.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt" | "taxIdLast4">;

const known = <T extends object>(values: T) => Object.fromEntries(Object.entries(values).filter(([, v]) => v != null && v !== "")) as Partial<T>;

export const providersRepo = {
  async list(ctx: ClinicianOnlyCtx): Promise<Provider[]> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    return decodeRows(providers, ring, await db.select().from(providers).where(tenantWhere(providers, ctx)).orderBy(asc(providers.name)));
  },

  async get(ctx: ClinicianOnlyCtx, id: string): Promise<Provider | null> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    const [row] = await db.select().from(providers).where(and(eq(providers.id, id), tenantWhere(providers, ctx)));
    return row ? decodeRow(providers, ring, row) : null;
  },

  // Matches on NPI when there is one, otherwise on name among this user's NPI-less providers.
  async upsertByNpiOrName(ctx: ClinicianOnlyCtx, values: ProviderValues): Promise<Provider> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    const match = values.npi
      ? and(tenantWhere(providers, ctx), eq(providers.npi, values.npi))
      : and(tenantWhere(providers, ctx), isNull(providers.npi), sql`lower(${providers.name}) = lower(${values.name})`);
    const [existing] = await db.select({ id: providers.id }).from(providers).where(match);
    if (existing) {
      const [row] = await db.update(providers).set(encodeRow(providers, ring, { ...known(values), updatedAt: new Date() })).where(and(eq(providers.id, existing.id), tenantWhere(providers, ctx))).returning();
      return decodeRow(providers, ring, row);
    }
    const [row] = await db.insert(providers).values(encodeRow(providers, ring, { ...values, id: newId("prv"), userId: ctx.userId }, { insert: true })).returning();
    return decodeRow(providers, ring, row);
  },
};
