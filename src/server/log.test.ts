import { afterEach, describe, expect, it, vi } from "vitest";
import { log, logFor } from "./log";

const plan = { id: "pln_1", userId: "usr_1", insurerName: "Cigna", memberId: "U4827193 01", groupNumber: "3340127", subscriberName: "Samira Haddad", patientName: "Samira Haddad", patientDob: "1992-11-02", patientAddress: "310 W 20th St Apt 5C, New York, NY 10011", patientPhone: "(212) 555-0117", patientEmail: "samira.haddad@example.test" };
const claim = { id: "clm_1", userId: "usr_1", planId: "pln_1", status: "submitted", billingProviderName: "Tom Whitfield, LMFT", billingProviderTaxId: "000-45-6789", billingProviderAddress: "3300 Grand Ave Suite B, Oakland, CA 94610", diagnosisCodes: ["F43.25", "Z63.0"], totalCharged: 44000, denialReason: "CO-197 precertification absent" };
const SECRETS = ["Samira", "Haddad", "U4827193", "3340127", "1992-11-02", "310 W 20th", "555-0117", "example.test", "Whitfield", "000-45-6789", "3300 Grand", "F43.25", "Z63.0", "CO-197"];

function capture(run: () => void): string {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((l: string) => void lines.push(l));
  run();
  spy.mockRestore();
  return lines.join("\n");
}

describe("log", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes one JSON line with the event name and a timestamp", () => {
    const out = JSON.parse(capture(() => log("claim.saved", { claimId: "clm_1", ms: 42 })));
    expect(out).toMatchObject({ event: "claim.saved", claimId: "clm_1", ms: 42 });
    expect(new Date(out.at).getTime()).not.toBeNaN();
  });

  it("drops everything that is not on the allow-list, even when handed whole rows", () => {
    const out = capture(() => log("claim.saved", { ...plan, ...claim, claim, plan, claimId: claim.id, userId: claim.userId, status: claim.status }));
    for (const secret of SECRETS) expect(out).not.toContain(secret);
    expect(JSON.parse(out)).toMatchObject({ event: "claim.saved", claimId: "clm_1", userId: "usr_1", status: "submitted" });
  });

  it("drops an allow-listed key whose value is not a plain scalar", () => {
    const out = JSON.parse(capture(() => log("x", { status: { nested: "Samira Haddad" }, code: ["F43.25"] })));
    expect(out.status).toBeUndefined();
    expect(out.code).toBeUndefined();
  });

  it("records only the name of an error, never its message", () => {
    const out = capture(() => log("claim.failed", { claimId: "clm_1", error: new Error('duplicate key value violates unique constraint (member_id)=(U4827193 01)') }));
    expect(out).not.toContain("U4827193");
    expect(JSON.parse(out).error).toBe("Error");
  });

  it("carries the claim id as the correlation id on every line from logFor", () => {
    const claimLog = logFor("clm_1");
    const lines = capture(() => {
      claimLog("stedi.submitted", { ms: 310 });
      claimLog("stedi.accepted");
    }).split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.cid)).toEqual(["clm_1", "clm_1"]);
    expect(lines.map((l) => l.claimId)).toEqual(["clm_1", "clm_1"]);
  });
});
