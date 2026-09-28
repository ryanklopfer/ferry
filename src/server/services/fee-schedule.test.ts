import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { centsToDollars, chargeFor, COMMON_BEHAVIORAL_CODES, dollarsToCents } from "@/core/fee-schedule";
import type { ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { claimsRepo } from "@/server/db/repos/claims";
import { clientsRepo } from "@/server/db/repos/clients";
import { plansRepo } from "@/server/db/repos/plans";
import { createTestUser, resetDb, seedClinicianProfile } from "@/server/db/testing";
import { feesView, profileForClaims, setFees } from "./clinician";

describe("chargeFor", () => {
  const schedule = [
    { cptCode: "90834", chargeCents: 15000 },
    { cptCode: "90837", chargeCents: 17500 },
  ];

  it("returns cents for a code on the schedule, or {missing: cpt}", () => {
    expect(chargeFor(schedule, "90837")).toBe(17500);
    expect(chargeFor(schedule, "90834")).toBe(15000);
    expect(chargeFor(schedule, "90791")).toEqual({ missing: "90791" });
    expect(chargeFor([], "90837")).toEqual({ missing: "90837" });
  });

  it("reads dollar amounts as cents and refuses anything else", () => {
    for (const [input, cents] of [["175", 17500], ["175.5", 17550], ["175.05", 17505], ["$1,175.00", 117500], [" 90 ", 9000], ["0", 0]] as const) expect(dollarsToCents(input), input).toBe(cents);
    for (const input of ["", "-5", "12.345", "abc", "1,75", "$", "1e3"]) expect(dollarsToCents(input), input).toBeNull();
    expect(centsToDollars(17500)).toBe("175");
    expect(centsToDollars(17550)).toBe("175.50");
  });

  it("describes every code in our own words, never the AMA descriptor", () => {
    for (const { code, label } of COMMON_BEHAVIORAL_CODES) {
      expect(code).toMatch(/^\d{5}$/);
      expect(label.length).toBeLessThan(60);
      expect(label).not.toMatch(/psychotherapy|with patient|evaluation and management|minutes with/i);
    }
  });
});

describe("the fee schedule", () => {
  let x: ClinicianCtx;
  let planId: string;

  beforeEach(async () => {
    await resetDb();
    x = await createTestUser("clinician");
    await seedClinicianProfile(x);
    const client = await clientsRepo.create(x, { firstName: "Devon", lastName: "Price", dob: null, email: null, phone: null });
    planId = (await plansRepo.create(x, client.id, { insurerName: "Aetna", memberId: "W268417359", subscriberName: "Devon Price", patientName: "Devon Price" })).id;
  });
  afterAll(() => pool.end());

  // What S8's claim builder does: price each line from the schedule as it stands, and copy the charge onto the line.
  async function buildClaim(cpt: string) {
    const { fees } = (await profileForClaims(x))!;
    const charge = chargeFor(fees, cpt);
    if (typeof charge !== "number") throw new Error(`no fee for ${charge.missing}`);
    const line = { serviceDate: "2026-10-05", cptCode: cpt, modifiers: [], description: null, units: 1, charge, diagnosisPointers: [1], placeOfService: "11" };
    return claimsRepo.create(x, { planId, totalCharged: charge }, [line]);
  }

  it("a fee edit affects only claims built afterwards", async () => {
    await setFees(x, [{ cptCode: "90837", amount: "175" }]);
    const before = await buildClaim("90837");

    await setFees(x, [{ cptCode: "90837", amount: "200" }]);
    const after = await buildClaim("90837");

    expect((await claimsRepo.lines(x, before.id)).map((l) => l.charge)).toEqual([17500]);
    expect((await claimsRepo.get(x, before.id))?.totalCharged).toBe(17500);
    expect((await claimsRepo.lines(x, after.id)).map((l) => l.charge)).toEqual([20000]);
    expect(await feesView(x)).toEqual([{ cptCode: "90837", chargeCents: 20000 }]);
  });

  it("replaces the whole schedule: blank amounts drop a code, and bad amounts or unknown codes change nothing", async () => {
    await setFees(x, [{ cptCode: "90834", amount: "150" }, { cptCode: "90837", amount: "175.50" }, { cptCode: "90791", amount: "" }]);
    expect(await feesView(x)).toEqual([{ cptCode: "90834", chargeCents: 15000 }, { cptCode: "90837", chargeCents: 17550 }]);

    await setFees(x, [{ cptCode: "90834", amount: "" }, { cptCode: "90837", amount: "180" }]);
    expect(await feesView(x)).toEqual([{ cptCode: "90837", chargeCents: 18000 }]);

    for (const [entries, reason] of [
      [[{ cptCode: "90837", amount: "0" }], "fee_format"],
      [[{ cptCode: "90837", amount: "-10" }], "fee_format"],
      [[{ cptCode: "99999", amount: "100" }], "invalid"],
      [[{ cptCode: "90837", amount: "" }], "no_fees"],
    ] as const) {
      await expect(setFees(x, entries)).rejects.toMatchObject({ reason });
    }
    expect(await feesView(x)).toEqual([{ cptCode: "90837", chargeCents: 18000 }]);
    await expect(pool.query("insert into fee_schedule_items (id, user_id, cpt_code, charge_cents) values ('fee_x', $1, '90791', 0)", [x.userId])).rejects.toThrow(/charge_positive/);
  });
});
