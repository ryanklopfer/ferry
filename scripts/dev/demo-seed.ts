import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, pool } from "../../src/server/db";
import { databaseUrl } from "../../src/server/db/env";
import { claimLines, claims, clientMemberships, clients, events, plans, users } from "../../src/server/db/schema";
import { assertDevTier, DeployConfigError, type Env } from "../../src/server/deploy";

// The isolation world from N4, with fixed ids so a second run adds nothing. Synthetic people only.
export const DEMO = {
  users: { x: "usr_demo_x", y: "usr_demo_y", u: "usr_demo_u" },
  clients: { a1: "cli_demo_a1", a2: "cli_demo_a2", b1: "cli_demo_b1" },
  memberships: { a1: "mbr_demo_a1", b1: "mbr_demo_b1" },
} as const;

const PEOPLE = [
  { key: "a1", tenant: DEMO.users.x, firstName: "Ana", lastName: "Ortiz", dob: "1990-04-02", clientUserId: DEMO.users.u, insurer: "Aetna", memberId: "W000000001" },
  { key: "a2", tenant: DEMO.users.x, firstName: "Ben", lastName: "Adler", dob: "1984-11-19", clientUserId: null, insurer: "Cigna", memberId: "U000000002" },
  { key: "b1", tenant: DEMO.users.y, firstName: "Ana", lastName: "Ortiz", dob: "1990-04-02", clientUserId: DEMO.users.u, insurer: "Aetna", memberId: "W000000001" },
] as const;

// bun run demo:seed. Dev tier only, and only against the database this process actually writes to.
export async function demoSeed(env: Env = process.env): Promise<void> {
  assertDevTier(env);
  if (env.DATABASE_URL !== databaseUrl()) throw new DeployConfigError("demo:seed checks DATABASE_URL, so it must be the database it writes to");

  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values([
        { id: DEMO.users.x, name: "Clinician X", email: "clinician-x@demo.test", emailVerified: true, role: "clinician" },
        { id: DEMO.users.y, name: "Clinician Y", email: "clinician-y@demo.test", emailVerified: true, role: "clinician" },
        { id: DEMO.users.u, name: "Client U", email: "client-u@demo.test", emailVerified: true, role: "client" },
      ])
      .onConflictDoNothing();

    for (const p of PEOPLE) {
      const clientId = DEMO.clients[p.key];
      await tx.insert(clients).values({ id: clientId, userId: p.tenant, firstName: p.firstName, lastName: p.lastName, dob: p.dob, email: p.clientUserId ? "client-u@demo.test" : null, phone: null, clientUserId: p.clientUserId }).onConflictDoNothing();
      if (p.key !== "a2") await tx.insert(clientMemberships).values({ id: DEMO.memberships[p.key], userId: DEMO.users.u, clinicianUserId: p.tenant, clientId }).onConflictDoNothing();
      const name = `${p.firstName} ${p.lastName}`;
      await tx.insert(plans).values({ id: `pln_demo_${p.key}`, userId: p.tenant, clientId, insurerName: p.insurer, memberId: p.memberId, subscriberName: name, subscriberDob: p.dob, patientName: name, patientDob: p.dob }).onConflictDoNothing();
      await tx.insert(claims).values({ id: `clm_demo_${p.key}`, userId: p.tenant, clientId, planId: `pln_demo_${p.key}`, diagnosisCodes: ["F41.1"], serviceDateStart: "2026-09-15", serviceDateEnd: "2026-09-15", totalCharged: 17500, totalPaid: 17500 }).onConflictDoNothing();
      await tx.insert(claimLines).values({ id: `lin_demo_${p.key}`, userId: p.tenant, clientId, claimId: `clm_demo_${p.key}`, position: 0, serviceDate: "2026-09-15", cptCode: "90834", units: 1, charge: 17500, diagnosisPointers: [1] }).onConflictDoNothing();
      await tx.insert(events).values({ id: `evt_demo_${p.key}`, userId: p.tenant, clientId, claimId: `clm_demo_${p.key}`, type: "created" }).onConflictDoNothing();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await demoSeed();
    console.log("demo:seed: clinicians X and Y, X's clients A1 and A2, Y's client B1, client user U bound to A1 and B1");
  } catch (e) {
    if (!(e instanceof DeployConfigError)) throw e;
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
