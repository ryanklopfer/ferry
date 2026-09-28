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

  it("keeps each new id-only key", () => {
    const fields = { clientId: "cli_1", membershipId: "mem_1", encounterId: "enc_1", captureId: "cap_1", noteId: "not_1", scanId: "scn_1", letterId: "let_1", taskId: "tsk_1", subscriptionId: "sub_1", timerId: "tmr_1", job: "claims.tick", vendor: "email", mode: "fixture", tier: "dev", digest: "123456" };
    expect(JSON.parse(capture(() => log("x", fields)))).toMatchObject(fields);
  });

  it("keeps a code identifier and drops a diagnosis code or a name in a code-like key", () => {
    const out = JSON.parse(capture(() => log("x", { code: "not_owned", kind: "Jane", type: "follow_up" })));
    expect(out.code).toBe("not_owned");
    expect(out.type).toBe("follow_up");
    expect(out.kind).toBeUndefined();
    const dropped = JSON.parse(capture(() => log("x", { code: "F43.25", kind: "Jane", status: "Samira Haddad", state: "NY", from: "Cigna", to: "jordan@example.test" })));
    for (const key of ["code", "kind", "status", "state", "from", "to"]) expect(dropped[key], key).toBeUndefined();
  });

  it("never writes an IP address or a user agent, under any key a caller might use", () => {
    const ip = "203.0.113.77";
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Ferry-UA-Marker";
    const out = capture(() =>
      log("consent.recorded", { ip, ipAddress: ip, remoteAddress: ip, "x-forwarded-for": ip, userAgent: ua, user_agent: ua, "user-agent": ua, headers: { "user-agent": ua, "x-forwarded-for": ip }, consent: { ip, userAgent: ua } }),
    );
    expect(out).not.toContain("203.0.113");
    expect(out).not.toContain("Ferry-UA-Marker");
    expect(out).not.toContain("Mozilla");
  });

  it("emits no Tax ID when handed a whole clinician profile", () => {
    const profile = { id: "prf_1", userId: "usr_1", legalName: "Rachel Steinberg", npi: "1999000023", taxId: "917382046", taxIdType: "SSN", taxIdLast4: "2046", taxIdBidx: "q3Xk", practiceAddress: { line1: "4471 Wexford Hollow Rd", city: "Oakland" } };
    const out = capture(() => {
      log("clinician.profile_saved", { ...profile, profile, userId: profile.userId });
      log("clinician.profile_saved", { taxId: profile.taxId, tax_id: profile.taxId, ssn: profile.taxId, ein: profile.taxId, code: profile.taxId });
    });
    for (const secret of ["917382046", "917-38-2046", "Wexford", "Steinberg", "2046"]) expect(out, secret).not.toContain(secret);
  });

  it("never takes a name from something that is not an error", () => {
    expect(JSON.parse(capture(() => log("x", { error: { name: "Samira" } }))).error).toBe("Error");
    expect(JSON.parse(capture(() => log("x", { error: new TypeError("U4827193") }))).error).toBe("TypeError");
  });
});
