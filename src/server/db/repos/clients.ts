import { and, eq, isNull } from "drizzle-orm";
import type { ClinicianOnlyCtx, Ctx } from "@/server/auth/ctx";
import { keyringFor } from "./tenant-keys";
import { db } from "../index";
import { blindFor, decodeRow, decodeRows, encodeRow } from "../codec";
import { newId } from "../ids";
import { type Client, clients } from "../schema";
import { assertNotClient, tenantWhere } from "./scope";

export type NewClient = Pick<typeof clients.$inferInsert, "firstName" | "lastName" | "dob" | "email" | "phone">;

// Names are sealed, so the database can't sort by them; the decoded rows are sorted here.
const byName = (a: Client, b: Client) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id);

export const clientsRepo = {
  async list(ctx: Ctx): Promise<Client[]> {
    const ring = await keyringFor(ctx);
    return decodeRows(clients, ring, await db.select().from(clients).where(tenantWhere(clients, ctx))).sort(byName);
  },

  async get(ctx: Ctx, id: string): Promise<Client | null> {
    const ring = await keyringFor(ctx);
    const [row] = await db.select().from(clients).where(and(eq(clients.id, id), tenantWhere(clients, ctx)));
    return row ? decodeRow(clients, ring, row) : null;
  },

  // Ids only, through the blind index: nothing is decrypted to find them.
  async idsByEmail(ctx: Ctx, email: string): Promise<string[]> {
    const ring = await keyringFor(ctx);
    const rows = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.emailBidx, blindFor(clients, "emailBidx", ring, email)), tenantWhere(clients, ctx)));
    return rows.map((r) => r.id);
  },

  async create(ctx: ClinicianOnlyCtx, values: NewClient): Promise<Client> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    const [row] = await db.insert(clients).values(encodeRow(clients, ring, { ...values, id: newId("cli"), userId: ctx.userId }, { insert: true })).returning();
    return decodeRow(clients, ring, row);
  },

  async archive(ctx: ClinicianOnlyCtx, id: string): Promise<boolean> {
    assertNotClient(ctx);
    const archived = await db.update(clients).set({ archivedAt: new Date() }).where(and(eq(clients.id, id), isNull(clients.archivedAt), tenantWhere(clients, ctx))).returning({ id: clients.id });
    return archived.length > 0;
  },
};
