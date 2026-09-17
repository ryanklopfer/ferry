import { describe, expect, it } from "vitest";
import type { Claim, FollowUp, Plan } from "@/db/schema";
import { RULES, computeFollowUps, staleFollowUps, timelyFilingDeadline } from "./followups";
import { parseExtraction } from "./extraction";

const DAY = 86_400;
const plan = { id: 1, timelyFilingDays: 180 } as Plan;
const base = { id: 1, planId: 1, status: "draft", serviceDateStart: "2026-06-01", serviceDateEnd: "2026-06-01", diagnosisCodes: [], submittedAt: null, decisionAt: null, updatedAt: 0 } as unknown as Claim;
const fu = (type: FollowUp["type"], dueAt: number, status: FollowUp["status"] = "pending") => ({ id: Math.random(), claimId: 1, type, dueAt, status }) as FollowUp;

describe("computeFollowUps", () => {
  it("warns before the timely filing deadline for drafts", () => {
    const out = computeFollowUps(base, plan, []);
    const deadline = timelyFilingDeadline(base, plan)!;
    expect(out).toEqual([{ type: "timely_filing_warning", dueAt: deadline - RULES.timelyFilingWarningDays * DAY }]);
    expect(new Date(deadline * 1000).toISOString().slice(0, 10)).toBe("2026-11-28");
  });

  it("schedules inquiry → escalation → regulator after submission", () => {
    const submittedAt = 1_760_000_000;
    const out = computeFollowUps({ ...base, status: "submitted", submittedAt }, plan, []);
    expect(out.map((o) => o.type)).toEqual(["status_inquiry", "escalation", "regulator_escalation"]);
    expect(out[0].dueAt).toBe(submittedAt + 14 * DAY);
    expect(out[2].dueAt).toBe(submittedAt + 45 * DAY);
  });

  it("is idempotent against existing follow-ups", () => {
    const submittedAt = 1_760_000_000;
    const claim = { ...base, status: "submitted", submittedAt } as Claim;
    const first = computeFollowUps(claim, plan, []);
    const existing = first.map((p) => fu(p.type, p.dueAt));
    expect(computeFollowUps(claim, plan, existing)).toEqual([]);
  });

  it("opens an appeal immediately on denial and nothing when paid", () => {
    expect(computeFollowUps({ ...base, status: "denied", decisionAt: 5 }, plan, [])).toEqual([{ type: "appeal", dueAt: 5 }]);
    expect(computeFollowUps({ ...base, status: "paid" }, plan, [])).toEqual([]);
  });
});

describe("staleFollowUps", () => {
  it("dismisses submission follow-ups once the claim is paid, keeps sent history", () => {
    const existing = [fu("status_inquiry", 1), fu("escalation", 2, "sent"), fu("regulator_escalation", 3, "drafted")];
    const stale = staleFollowUps({ ...base, status: "paid" }, existing);
    expect(stale.map((s) => s.type)).toEqual(["status_inquiry", "regulator_escalation"]);
  });
});

describe("parseExtraction", () => {
  it("tolerates prose around the JSON and applies defaults", () => {
    const raw = `Here you go:\n{"providerName":"Dr. X","providerNpi":null,"providerTaxId":null,"providerAddress":null,"providerPhone":null,"patientName":null,"placeOfService":"11","diagnosisCodes":["M54.5"],"lineItems":[{"serviceDate":"2026-06-01","cptCode":"97110","modifier":null,"description":null,"charge":120}],"totalCharged":120,"totalPaid":null,"notes":null}`;
    const x = parseExtraction(raw);
    expect(x.lineItems[0].units).toBe(1);
    expect(x.diagnosisCodes).toEqual(["M54.5"]);
  });
  it("rejects malformed output", () => {
    expect(() => parseExtraction("no json here")).toThrow();
  });
});
