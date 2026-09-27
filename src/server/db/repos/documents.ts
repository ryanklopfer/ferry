import { and, asc, eq } from "drizzle-orm";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { db } from "../index";
import { newId } from "../ids";
import { type Document, type DocumentKind, documents } from "../schema";
import { assertClaimOwned } from "./owned";

export type NewDocument = Omit<typeof documents.$inferInsert, "id" | "userId" | "createdAt">;

export const documentsRepo = {
  forClaim(ctx: ClinicianOnlyCtx, claimId: string, kind?: DocumentKind): Promise<Document[]> {
    const where = and(eq(documents.claimId, claimId), eq(documents.userId, ctx.userId), kind ? eq(documents.kind, kind) : undefined);
    return db.select().from(documents).where(where).orderBy(asc(documents.createdAt));
  },

  async get(ctx: ClinicianOnlyCtx, id: string): Promise<Document | null> {
    const [row] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.userId, ctx.userId)));
    return row ?? null;
  },

  async create(ctx: ClinicianOnlyCtx, values: NewDocument & { id?: string }): Promise<Document> {
    if (values.claimId) await assertClaimOwned(ctx, values.claimId);
    const [row] = await db.insert(documents).values({ ...values, id: values.id ?? newId("doc"), userId: ctx.userId }).returning();
    return row;
  },

  async remove(ctx: ClinicianOnlyCtx, id: string): Promise<Document | null> {
    const [row] = await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, ctx.userId))).returning();
    return row ?? null;
  },
};
