import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/server/db";
import { databaseUrl } from "@/server/db/env";
import { resetDb } from "@/server/db/testing";
import { DEMO, demoSeed } from "./demo-seed";

const TABLES = ["users", "clients", "client_memberships", "plans", "claims", "claim_lines", "events"];
const DEV_ENV = () => ({ FERRY_DEPLOY_TIER: "dev", DATABASE_URL: databaseUrl() });

async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = (await pool.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0].n;
  return out;
}

describe("demo:seed", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("builds the isolation world, and a second run leaves identical row counts", async () => {
    await demoSeed(DEV_ENV());
    const first = await counts();
    expect(first).toEqual({ users: 3, clients: 3, client_memberships: 2, plans: 3, claims: 3, claim_lines: 3, events: 3 });
    await demoSeed(DEV_ENV());
    expect(await counts()).toEqual(first);
  });

  it("binds U to A1 and B1 only, across X and Y", async () => {
    await demoSeed(DEV_ENV());
    const { rows } = await pool.query<{ client_id: string; clinician_user_id: string; owner: string }>(
      "select m.client_id, m.clinician_user_id, c.user_id as owner from client_memberships m join clients c on c.id = m.client_id where m.user_id = $1 and m.status = 'active' order by m.client_id",
      [DEMO.users.u],
    );
    expect(rows).toEqual([
      { client_id: DEMO.clients.a1, clinician_user_id: DEMO.users.x, owner: DEMO.users.x },
      { client_id: DEMO.clients.b1, clinician_user_id: DEMO.users.y, owner: DEMO.users.y },
    ]);
    const { rows: a2 } = await pool.query("select user_id, client_user_id from clients where id = $1", [DEMO.clients.a2]);
    expect(a2).toEqual([{ user_id: DEMO.users.x, client_user_id: null }]);
  });

  it("refuses outside the dev tier and writes nothing", async () => {
    for (const tier of ["prelaunch", "staging", "prod"]) {
      await expect(demoSeed({ FERRY_DEPLOY_TIER: tier, DATABASE_URL: databaseUrl() })).rejects.toThrow(/dev tier/);
    }
    await expect(demoSeed({ FERRY_DEPLOY_TIER: "dev", DATABASE_URL: "postgres://db.example/ferry" })).rejects.toThrow(/_dev or _test/);
    expect(Object.values(await counts()).every((n) => n === 0)).toBe(true);
  });
});
