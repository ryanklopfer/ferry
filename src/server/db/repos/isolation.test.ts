import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clientCtxFor } from "@/server/auth/client-ctx";
import type { ClientCtx, ClinicianCtx, SelfCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { bindClientUser, createTestUser, resetDb, seedClinicianProfile } from "@/server/db/testing";
import { claimsRepo } from "./claims";
import { clientsRepo } from "./clients";
import { eventsRepo } from "./events";
import { followUpsRepo } from "./follow-ups";
import { plansRepo } from "./plans";
import { clinicianProfilesRepo } from "./clinician-profiles";
import { feeScheduleRepo } from "./fee-schedule";

const LINE = { serviceDate: "2026-08-04", cptCode: "90834", modifiers: [], description: "Psychotherapy, 45 min", units: 1, charge: 17500, diagnosisPointers: [1], placeOfService: "11" };

async function seedClient(ctx: ClinicianCtx, firstName: string, lastName: string) {
  const client = await clientsRepo.create(ctx, { firstName, lastName, dob: "1990-04-02", email: `${firstName.toLowerCase()}@example.test`, phone: null });
  const plan = await plansRepo.create(ctx, client.id, { insurerName: "Cigna", memberId: `U-${firstName}`, subscriberName: `${firstName} ${lastName}`, patientName: `${firstName} ${lastName}` });
  const claim = await claimsRepo.create(ctx, { planId: plan.id, billingProviderName: "Rachel Steinberg, LCSW", diagnosisCodes: ["F33.1"], totalCharged: 17500 }, [LINE]);
  const [followUp] = await followUpsRepo.createMany(ctx, claim.id, [{ type: "status_inquiry", dueAt: new Date("2026-10-01T00:00:00Z") }]);
  await eventsRepo.append(ctx, claim.id, "created", `Claim for ${firstName}`);
  return { client, plan, claim, followUp };
}

type Seeded = Awaited<ReturnType<typeof seedClient>>;
const ids = <T extends { id: string }>(rows: T[]) => rows.map((r) => r.id).sort();

// The isolation world (demo:seed builds the same one): clinicians X and Y; X's clients A1 and A2; Y's client B1;
// client user U bound to A1 and B1.
describe("tenant isolation v2", () => {
  let x: ClinicianCtx;
  let y: ClinicianCtx;
  let u: SelfCtx;
  let a1: Seeded;
  let a2: Seeded;
  let b1: Seeded;
  let uA1: string;
  let uB1: string;

  beforeEach(async () => {
    await resetDb();
    x = await createTestUser("clinician", "x@example.test");
    y = await createTestUser("clinician", "y@example.test");
    u = await createTestUser("client", "u@example.test");
    a1 = await seedClient(x, "Ana", "Ortiz");
    a2 = await seedClient(x, "Ben", "Adler");
    b1 = await seedClient(y, "Cara", "Nguyen");
    await seedClinicianProfile(x);
    await seedClinicianProfile(y, { legalName: "Owen Achebe", npi: "1234567893", taxId: "900115353" });
    await feeScheduleRepo.replace(x, [{ cptCode: "90837", chargeCents: 20000 }]);
    await feeScheduleRepo.replace(y, [{ cptCode: "90834", chargeCents: 15000 }]);
    uA1 = await bindClientUser(x, a1.client.id, u);
    uB1 = await bindClientUser(y, b1.client.id, u);
  });
  afterAll(() => pool.end());

  describe("clinicians", () => {
    it("X reads only A1 and A2 rows in every repo", async () => {
      expect(ids(await clientsRepo.list(x))).toEqual(ids([a1.client, a2.client]));
      expect(ids(await plansRepo.list(x))).toEqual(ids([a1.plan, a2.plan]));
      expect(ids((await claimsRepo.list(x)).map((r) => r.claim))).toEqual(ids([a1.claim, a2.claim]));
      expect(ids(await followUpsRepo.open(x))).toEqual(ids([a1.followUp, a2.followUp]));
      expect(await clinicianProfilesRepo.get(x)).toMatchObject({ userId: x.userId, npi: "1999000023" });
      expect(await feeScheduleRepo.list(x)).toEqual([{ cptCode: "90837", chargeCents: 20000 }]);
      for (const mine of [a1, a2]) {
        expect((await clientsRepo.get(x, mine.client.id))?.id).toBe(mine.client.id);
        expect((await plansRepo.get(x, mine.plan.id))?.id).toBe(mine.plan.id);
        expect((await claimsRepo.get(x, mine.claim.id))?.id).toBe(mine.claim.id);
        expect(await claimsRepo.lines(x, mine.claim.id)).toHaveLength(1);
        expect(await eventsRepo.forClaim(x, mine.claim.id)).toHaveLength(1);
        expect(await followUpsRepo.forClaim(x, mine.claim.id)).toHaveLength(1);
      }
      expect(await clientsRepo.get(x, b1.client.id)).toBeNull();
      expect(await plansRepo.get(x, b1.plan.id)).toBeNull();
      expect(await claimsRepo.get(x, b1.claim.id)).toBeNull();
      expect(await claimsRepo.lines(x, b1.claim.id)).toEqual([]);
      expect(await eventsRepo.forClaim(x, b1.claim.id)).toEqual([]);
    });

    it("Y reads nothing of X's, in lists or by id", async () => {
      expect(ids(await clientsRepo.list(y))).toEqual([b1.client.id]);
      expect(ids(await plansRepo.list(y))).toEqual([b1.plan.id]);
      expect(ids((await claimsRepo.list(y)).map((r) => r.claim))).toEqual([b1.claim.id]);
      expect(ids(await followUpsRepo.open(y))).toEqual([b1.followUp.id]);
      expect(await clinicianProfilesRepo.get(y)).toMatchObject({ userId: y.userId, npi: "1234567893" });
      expect(await feeScheduleRepo.list(y)).toEqual([{ cptCode: "90834", chargeCents: 15000 }]);
      for (const theirs of [a1, a2]) {
        expect(await clientsRepo.get(y, theirs.client.id)).toBeNull();
        expect(await plansRepo.get(y, theirs.plan.id)).toBeNull();
        expect(await claimsRepo.get(y, theirs.claim.id)).toBeNull();
        expect(await followUpsRepo.get(y, theirs.followUp.id)).toBeNull();
        expect(await claimsRepo.lines(y, theirs.claim.id)).toEqual([]);
        expect(await followUpsRepo.forClaim(y, theirs.claim.id)).toEqual([]);
        expect(await eventsRepo.forClaim(y, theirs.claim.id)).toEqual([]);
      }
    });

    it("Y changes and deletes nothing of X's", async () => {
      await claimsRepo.update(y, a1.claim.id, { status: "closed", billingProviderName: "Hijacked" });
      await claimsRepo.save(y, a1.claim.id, { billingProviderName: "Hijacked" }, []);
      await claimsRepo.replaceLines(y, a1.claim.id, []);
      await followUpsRepo.update(y, a1.followUp.id, { status: "sent" });
      await followUpsRepo.dismiss(y, [a1.followUp.id]);
      await clientsRepo.archive(y, a2.client.id);
      await claimsRepo.remove(y, a2.claim.id);
      await feeScheduleRepo.replace(y, []);

      expect(await feeScheduleRepo.list(x)).toEqual([{ cptCode: "90837", chargeCents: 20000 }]);
      const claim = await claimsRepo.get(x, a1.claim.id);
      expect(claim?.status).toBe("draft");
      expect(claim?.billingProviderName).toBe("Rachel Steinberg, LCSW");
      expect(await claimsRepo.lines(x, a1.claim.id)).toHaveLength(1);
      expect((await followUpsRepo.get(x, a1.followUp.id))?.status).toBe("pending");
      expect((await clientsRepo.get(x, a2.client.id))?.archivedAt).toBeNull();
      expect(await claimsRepo.get(x, a2.claim.id)).not.toBeNull();
    });

    it("Y attaches nothing to X's rows", async () => {
      await expect(plansRepo.create(y, a1.client.id, { insurerName: "Aetna", memberId: "W1", subscriberName: "Ana Ortiz", patientName: "Ana Ortiz" })).rejects.toThrow();
      await expect(claimsRepo.create(y, { planId: a1.plan.id }, [])).rejects.toThrow();
      await expect(followUpsRepo.createMany(y, a1.claim.id, [{ type: "appeal", dueAt: new Date() }])).rejects.toThrow();
      await expect(eventsRepo.append(y, a1.claim.id, "note", "hello")).rejects.toThrow();
      expect(await plansRepo.list(x)).toHaveLength(2);
      expect(await eventsRepo.forClaim(x, a1.claim.id)).toHaveLength(1);
    });

    it("stamps each claim, line and event with its plan's client", async () => {
      const { rows } = await pool.query<{ t: string; client_id: string }>(
        "select 'claim' as t, client_id from claims where id = $1 union all select 'line', client_id from claim_lines where claim_id = $1 union all select 'event', client_id from events where claim_id = $1",
        [a2.claim.id],
      );
      expect(rows.map((r) => r.client_id)).toEqual([a2.client.id, a2.client.id, a2.client.id]);
    });
  });

  describe("a client user", () => {
    let asA1: ClientCtx;
    let asB1: ClientCtx;

    beforeEach(async () => {
      asA1 = await clientCtxFor(u, uA1);
      asB1 = await clientCtxFor(u, uB1);
    });

    it("through the A1 membership reads A1's client row, plans, claims and events and nothing of A2's", async () => {
      expect(asA1).toEqual({ scope: "client", userId: x.userId, clientId: a1.client.id, actorId: u.userId });
      expect(ids(await clientsRepo.list(asA1))).toEqual([a1.client.id]);
      expect((await clientsRepo.get(asA1, a1.client.id))?.firstName).toBe("Ana");
      expect(ids(await plansRepo.list(asA1))).toEqual([a1.plan.id]);
      expect(ids((await claimsRepo.list(asA1)).map((r) => r.claim))).toEqual([a1.claim.id]);
      expect(await claimsRepo.lines(asA1, a1.claim.id)).toHaveLength(1);
      expect((await eventsRepo.forClaim(asA1, a1.claim.id)).map((e) => e.note)).toEqual(["Claim for Ana"]);

      expect(await clientsRepo.get(asA1, a2.client.id)).toBeNull();
      expect(await plansRepo.get(asA1, a2.plan.id)).toBeNull();
      expect(await claimsRepo.get(asA1, a2.claim.id)).toBeNull();
      expect(await claimsRepo.lines(asA1, a2.claim.id)).toEqual([]);
      expect(await eventsRepo.forClaim(asA1, a2.claim.id)).toEqual([]);
    });

    it("through the B1 membership reads only B1's", async () => {
      expect(asB1).toEqual({ scope: "client", userId: y.userId, clientId: b1.client.id, actorId: u.userId });
      expect(ids(await clientsRepo.list(asB1))).toEqual([b1.client.id]);
      expect(ids(await plansRepo.list(asB1))).toEqual([b1.plan.id]);
      expect(ids((await claimsRepo.list(asB1)).map((r) => r.claim))).toEqual([b1.claim.id]);
      expect(await eventsRepo.forClaim(asB1, b1.claim.id)).toHaveLength(1);
      for (const other of [a1, a2]) {
        expect(await clientsRepo.get(asB1, other.client.id)).toBeNull();
        expect(await plansRepo.get(asB1, other.plan.id)).toBeNull();
        expect(await claimsRepo.get(asB1, other.claim.id)).toBeNull();
        expect(await claimsRepo.lines(asB1, other.claim.id)).toEqual([]);
        expect(await eventsRepo.forClaim(asB1, other.claim.id)).toEqual([]);
      }
    });

    it("is refused by every write and clinician-only repo at run time, even past the type checker", async () => {
      const c = asA1 as never;
      await expect(claimsRepo.update(c, a1.claim.id, { status: "closed" })).rejects.toThrow();
      await expect(claimsRepo.remove(c, a1.claim.id)).rejects.toThrow();
      await expect(claimsRepo.replaceLines(c, a1.claim.id, [])).rejects.toThrow();
      await expect(claimsRepo.create(c, { planId: a1.plan.id }, [])).rejects.toThrow();
      await expect(plansRepo.create(c, a1.client.id, { insurerName: "Aetna", memberId: "W1", subscriberName: "Ana Ortiz", patientName: "Ana Ortiz" })).rejects.toThrow();
      await expect(eventsRepo.append(c, a1.claim.id, "note")).rejects.toThrow();
      await expect(clientsRepo.archive(c, a1.client.id)).rejects.toThrow();
      await expect(followUpsRepo.open(c)).rejects.toThrow();
      await expect(followUpsRepo.forClaim(c, a1.claim.id)).rejects.toThrow();
      await expect(clinicianProfilesRepo.get(c)).rejects.toThrow();
      await expect(feeScheduleRepo.list(c)).rejects.toThrow();
      expect((await claimsRepo.get(x, a1.claim.id))?.status).toBe("draft");
      expect(await claimsRepo.lines(x, a1.claim.id)).toHaveLength(1);
    });
  });
});
