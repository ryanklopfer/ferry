import { and, eq, getTableName, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { ClinicianOnlyCtx, Ctx } from "@/server/auth/ctx";
import { claimLines, claims, clientConsents, clients, events, plans } from "../schema";

export class ScopeRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeRefused";
  }
}

// Tables about one client: a ClientCtx sees only rows with its client_id (architecture §6 rule 4).
const CLIENT_SCOPED_TABLES: PgTable[] = [plans, claims, claimLines, events, clientConsents];
// The clients table itself: a ClientCtx sees only the row whose id is its client.
const CLIENT_SELF_TABLES: PgTable[] = [clients];

export const CLIENT_SCOPED: readonly string[] = CLIENT_SCOPED_TABLES.map(getTableName);
export const CLIENT_SELF: readonly string[] = CLIENT_SELF_TABLES.map(getTableName);
// CLIENT_SCOPED tables whose client_id may be null; each needs a CHECK naming client_id (tasks, from S10).
export const CLIENT_ID_NULLABLE: readonly string[] = [];
// Reference tables with no owner (payer directory, code sets). Adding one here is a reviewed decision.
export const GLOBAL_TABLES: readonly string[] = [];

type Tenanted = PgTable & { userId: PgColumn };

export function tenantWhere(table: Tenanted, ctx: Ctx): SQL {
  const owner = eq(table.userId, ctx.userId);
  switch (ctx.scope) {
    case "clinician":
    case "system":
      return owner;
    case "client":
      if (CLIENT_SELF_TABLES.includes(table)) return and(owner, eq((table as typeof clients).id, ctx.clientId))!;
      if (CLIENT_SCOPED_TABLES.includes(table)) return and(owner, eq((table as typeof claims).clientId, ctx.clientId))!;
      throw new ScopeRefused(`A client context cannot read ${getTableName(table)}`);
    default:
      throw new ScopeRefused("No tenant repo accepts this context");
  }
}

// Clinician-only repos type ctx as ClinicianOnlyCtx; this refuses a ClientCtx (or anything else) that got past the type checker.
export function assertNotClient(ctx: Ctx): asserts ctx is ClinicianOnlyCtx {
  if (ctx.scope !== "clinician" && ctx.scope !== "system") throw new ScopeRefused(`Clinician-only data refuses a ${ctx.scope === "client" ? "client" : "non-clinician"} context`);
}
