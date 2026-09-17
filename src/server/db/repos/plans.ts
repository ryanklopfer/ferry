import { and, asc, eq } from "drizzle-orm";
import type { Ctx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { type Plan, plans } from "../schema";

export type NewPlan = Omit<typeof plans.$inferInsert, "id" | "userId" | "createdAt">;

export const plansRepo = {
  list(ctx: Ctx): Promise<Plan[]> {
    return db.select().from(plans).where(eq(plans.userId, ctx.userId)).orderBy(asc(plans.insurerName), asc(plans.createdAt));
  },

  async get(ctx: Ctx, id: string): Promise<Plan | null> {
    const [row] = await db.select().from(plans).where(and(eq(plans.id, id), eq(plans.userId, ctx.userId)));
    return row ?? null;
  },

  async create(ctx: Ctx, values: NewPlan): Promise<Plan> {
    const [row] = await db.insert(plans).values({ ...values, id: newId("pln"), userId: ctx.userId }).returning();
    return row;
  },
};
