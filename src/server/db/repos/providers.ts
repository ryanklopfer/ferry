import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Ctx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { type Provider, providers } from "../schema";

export type ProviderValues = Omit<typeof providers.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">;

const known = <T extends object>(values: T) => Object.fromEntries(Object.entries(values).filter(([, v]) => v != null && v !== "")) as Partial<T>;

export const providersRepo = {
  list(ctx: Ctx): Promise<Provider[]> {
    return db.select().from(providers).where(eq(providers.userId, ctx.userId)).orderBy(asc(providers.name));
  },

  async get(ctx: Ctx, id: string): Promise<Provider | null> {
    const [row] = await db.select().from(providers).where(and(eq(providers.id, id), eq(providers.userId, ctx.userId)));
    return row ?? null;
  },

  // Matches on NPI when there is one, otherwise on name among this user's NPI-less providers.
  async upsertByNpiOrName(ctx: Ctx, values: ProviderValues): Promise<Provider> {
    const match = values.npi
      ? and(eq(providers.userId, ctx.userId), eq(providers.npi, values.npi))
      : and(eq(providers.userId, ctx.userId), isNull(providers.npi), sql`lower(${providers.name}) = lower(${values.name})`);
    const [existing] = await db.select().from(providers).where(match);
    if (existing) {
      const [row] = await db.update(providers).set({ ...known(values), updatedAt: new Date() }).where(and(eq(providers.id, existing.id), eq(providers.userId, ctx.userId))).returning();
      return row;
    }
    const [row] = await db.insert(providers).values({ ...values, id: newId("prv"), userId: ctx.userId }).returning();
    return row;
  },
};
