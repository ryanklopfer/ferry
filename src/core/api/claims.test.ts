import { describe, expect, it } from "vitest";
import { ClaimSummarySchema } from "./claims";

const summary = {
  id: "clm_01JABCDEFGHJKMNPQRSTVWXYZ0",
  status: "draft",
  insurerName: "Aetna",
  billingProviderName: null,
  serviceDateStart: "2026-08-05",
  serviceDateEnd: null,
  totalChargedCents: 54000,
  amountReimbursedCents: null,
  updatedAt: "2026-09-17T16:00:00.000Z",
};

describe("ClaimSummarySchema", () => {
  it("accepts the documented shape", () => {
    expect(ClaimSummarySchema.parse(summary)).toEqual(summary);
  });

  it("refuses a field that is not part of the contract, so a leaked column cannot ship", () => {
    expect(() => ClaimSummarySchema.parse({ ...summary, memberId: "W268417359" })).toThrow();
    expect(() => ClaimSummarySchema.parse({ ...summary, billingProviderTaxId: "00-1000006" })).toThrow();
  });

  it("refuses a status we do not have", () => {
    expect(() => ClaimSummarySchema.parse({ ...summary, status: "lost" })).toThrow();
  });
});
