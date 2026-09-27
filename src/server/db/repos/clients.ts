import { and, asc, eq, isNull } from "drizzle-orm";
import type { ClinicianOnlyCtx, Ctx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { type Client, clients } from "../schema";
import { assertNotClient, tenantWhere } from "./scope";

export type NewClient = Pick<typeof clients.$inferInsert, "firstName" | "lastName" | "dob" | "email" | "phone">;

export const clientsRepo = {
  list(ctx: Ctx): Promise<Client[]> {
    return db.select().from(clients).where(tenantWhere(clients, ctx)).orderBy(asc(clients.lastName), asc(clients.firstName), asc(clients.id));
  },

  async get(ctx: Ctx, id: string): Promise<Client | null> {
    const [row] = await db.select().from(clients).where(and(eq(clients.id, id), tenantWhere(clients, ctx)));
    return row ?? null;
  },

  async create(ctx: ClinicianOnlyCtx, values: NewClient): Promise<Client> {
    assertNotClient(ctx);
    const [row] = await db.insert(clients).values({ ...values, id: newId("cli"), userId: ctx.userId }).returning();
    return row;
  },

  async archive(ctx: ClinicianOnlyCtx, id: string): Promise<boolean> {
    assertNotClient(ctx);
    const archived = await db.update(clients).set({ archivedAt: new Date() }).where(and(eq(clients.id, id), isNull(clients.archivedAt), tenantWhere(clients, ctx))).returning({ id: clients.id });
    return archived.length > 0;
  },
};
