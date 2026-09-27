import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { ClientCtx, ClinicianCtx, SystemCtx } from "@/server/auth/ctx";
import { claimLines, claims, clients, events, followUps, plans, providers } from "../schema";
import { assertNotClient, CLIENT_SCOPED, CLIENT_SELF, tenantWhere } from "./scope";

const dialect = new PgDialect();
const render = (...args: Parameters<typeof tenantWhere>) => dialect.sqlToQuery(tenantWhere(...args));

const clinician: ClinicianCtx = { scope: "clinician", userId: "usr_x" };
const system: SystemCtx = { scope: "system", userId: "usr_x", job: "timers.tick" };
const client: ClientCtx = { scope: "client", userId: "usr_x", clientId: "cli_a1", actorId: "usr_u" };

describe("tenantWhere", () => {
  it("lists clients as CLIENT_SELF and plans, claims, claim_lines and events as CLIENT_SCOPED", () => {
    expect([...CLIENT_SELF]).toEqual(["clients"]);
    expect([...CLIENT_SCOPED].sort()).toEqual(["claim_lines", "claims", "events", "plans"]);
  });

  it("filters only on the tenant for a clinician or system context", () => {
    for (const ctx of [clinician, system]) {
      for (const table of [clients, plans, claims, claimLines, events, followUps, providers]) {
        const q = render(table, ctx);
        expect(q.sql).toMatch(/^"\w+"\."user_id" = \$1$/);
        expect(q.params).toEqual(["usr_x"]);
      }
    }
  });

  it("with a ClientCtx matches the clients row by id", () => {
    expect(render(clients, client)).toMatchObject({ sql: '("clients"."user_id" = $1 and "clients"."id" = $2)', params: ["usr_x", "cli_a1"] });
  });

  it("with a ClientCtx filters every CLIENT_SCOPED table by client_id", () => {
    for (const [table, name] of [[plans, "plans"], [claims, "claims"], [claimLines, "claim_lines"], [events, "events"]] as const) {
      expect(render(table, client)).toMatchObject({ sql: `("${name}"."user_id" = $1 and "${name}"."client_id" = $2)`, params: ["usr_x", "cli_a1"] });
    }
  });

  it("with a ClientCtx throws on any other table", () => {
    for (const table of [followUps, providers]) expect(() => tenantWhere(table, client)).toThrow(/client/i);
  });

  it("throws on a context with any other scope", () => {
    for (const scope of ["self", "invite", "staff"]) expect(() => tenantWhere(claims, { scope, userId: "usr_x" } as never)).toThrow();
  });
});

describe("assertNotClient", () => {
  it("passes clinician and system contexts and refuses a client", () => {
    expect(() => assertNotClient(clinician)).not.toThrow();
    expect(() => assertNotClient(system)).not.toThrow();
    expect(() => assertNotClient(client)).toThrow(/client/i);
    expect(() => assertNotClient({ scope: "staff", userId: "usr_s" } as never)).toThrow();
  });
});
