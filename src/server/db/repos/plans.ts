import { and, asc, eq } from "drizzle-orm";
import type { ClinicianOnlyCtx, Ctx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { type Plan, clients, plans } from "../schema";
import { NotOwnedError } from "@/server/errors";
import { assertNotClient, tenantWhere } from "./scope";

export type NewPlan = Omit<typeof plans.$inferInsert, "id" | "userId" | "clientId" | "createdAt">;

export const plansRepo = {
  list(ctx: Ctx): Promise<Plan[]> {
    return db.select().from(plans).where(tenantWhere(plans, ctx)).orderBy(asc(plans.insurerName), asc(plans.createdAt));
  },

  async get(ctx: Ctx, id: string): Promise<Plan | null> {
    const [row] = await db.select().from(plans).where(and(eq(plans.id, id), tenantWhere(plans, ctx)));
    return row ?? null;
  },

  async create(ctx: ClinicianOnlyCtx, clientId: string, values: NewPlan): Promise<Plan> {
    assertNotClient(ctx);
    return db.transaction(async (tx) => {
      const [client] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), tenantWhere(clients, ctx)));
      if (!client) throw new NotOwnedError("Client");
      const [row] = await tx.insert(plans).values({ ...values, id: newId("pln"), userId: ctx.userId, clientId }).returning();
      return row;
    });
  },
};
