import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { ClientDocType, ClinicianDocType, SignerRelationship } from "@/core/legal";
import type { ClientCtx, ClinicianOnlyCtx, Ctx } from "@/server/auth/ctx";
import { keyringFor } from "./tenant-keys";
import { db } from "../index";
import { decodeRows, encodeRow } from "../codec";
import { newId } from "../ids";
import { type ClientConsent, type ClinicianConsent, clientConsents, clinicianConsents } from "../schema";
import { assertNotClient, ScopeRefused, tenantWhere } from "./scope";

type Signed = { version: string; contentHash: string; typedName: string; ip: string | null; userAgent: string | null };
export type NewClinicianConsent = Signed & { docType: ClinicianDocType };
export type NewClientConsent = Signed & { docType: ClientDocType; signerRelationship: SignerRelationship };
export type ConsentWithdrawn = { tenant: string; clientId: string; docType: ClientDocType };

// Rows are appended, never edited: a re-consent is a new row, and withdrawal only sets withdrawn_at.
export const clinicianConsentsRepo = {
  async list(ctx: ClinicianOnlyCtx): Promise<ClinicianConsent[]> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    return decodeRows(clinicianConsents, ring, await db.select().from(clinicianConsents).where(tenantWhere(clinicianConsents, ctx)).orderBy(asc(clinicianConsents.createdAt)));
  },

  async create(ctx: ClinicianOnlyCtx, values: NewClinicianConsent): Promise<{ id: string }> {
    const [row] = await clinicianConsentsRepo.createAll(ctx, [values]);
    return row;
  },

  // One statement, so texts signed together are recorded together or not at all.
  async createAll(ctx: ClinicianOnlyCtx, values: readonly NewClinicianConsent[]): Promise<{ id: string }[]> {
    assertNotClient(ctx);
    if (!values.length) return [];
    const ring = await keyringFor(ctx);
    const ids = values.map(() => newId("ccn"));
    await db.insert(clinicianConsents).values(values.map((v, i) => encodeRow(clinicianConsents, ring, { ...v, id: ids[i], userId: ctx.userId }, { insert: true })));
    return ids.map((id) => ({ id }));
  },

  async withdraw(ctx: ClinicianOnlyCtx, docType: ClinicianDocType): Promise<boolean> {
    assertNotClient(ctx);
    const rows = await db
      .update(clinicianConsents)
      .set({ withdrawnAt: new Date() })
      .where(and(eq(clinicianConsents.docType, docType), isNull(clinicianConsents.withdrawnAt), tenantWhere(clinicianConsents, ctx)))
      .returning({ id: clinicianConsents.id });
    return rows.length > 0;
  },
};

function assertClient(ctx: Ctx): asserts ctx is ClientCtx {
  if (ctx.scope !== "client") throw new ScopeRefused("Only the client, or someone signing for them, writes a client consent");
}

export const clientConsentsRepo = {
  // A ClientCtx sees only its own client's rows (tenantWhere); a clinician sees any of their clients'.
  async listFor(ctx: Ctx, clientId: string): Promise<ClientConsent[]> {
    const ring = await keyringFor(ctx);
    const rows = await db.select().from(clientConsents).where(and(eq(clientConsents.clientId, clientId), tenantWhere(clientConsents, ctx))).orderBy(asc(clientConsents.createdAt));
    return decodeRows(clientConsents, ring, rows);
  },

  async create(ctx: ClientCtx, values: NewClientConsent): Promise<{ id: string }> {
    const [row] = await clientConsentsRepo.createAll(ctx, [values]);
    return row;
  },

  async createAll(ctx: ClientCtx, values: readonly NewClientConsent[]): Promise<{ id: string }[]> {
    assertClient(ctx);
    if (!values.length) return [];
    const ring = await keyringFor(ctx);
    const ids = values.map(() => newId("kcn"));
    await db.insert(clientConsents).values(values.map((v, i) => encodeRow(clientConsents, ring, { ...v, id: ids[i], userId: ctx.userId, clientId: ctx.clientId, actorUserId: ctx.actorId }, { insert: true })));
    return ids.map((id) => ({ id }));
  },

  // Postgres delivers the notification only when the transaction commits, and only if a row changed. Ids only:
  // the relay (N12) and the filing gate (N10) listen for it.
  async withdraw(ctx: ClientCtx, docType: ClientDocType): Promise<ConsentWithdrawn | null> {
    assertClient(ctx);
    return db.transaction(async (tx) => {
      const rows = await tx
        .update(clientConsents)
        .set({ withdrawnAt: new Date() })
        .where(and(eq(clientConsents.docType, docType), isNull(clientConsents.withdrawnAt), tenantWhere(clientConsents, ctx)))
        .returning({ id: clientConsents.id });
      if (!rows.length) return null;
      const event: ConsentWithdrawn = { tenant: ctx.userId, clientId: ctx.clientId, docType };
      await tx.execute(sql`select pg_notify('consent_withdrawn', ${JSON.stringify(event)})`);
      return event;
    });
  },
};
