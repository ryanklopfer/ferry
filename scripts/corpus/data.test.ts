import { describe, expect, it } from "vitest";
import { isValidNpi } from "../../src/core/npi";
import { CARDS, SUPERBILLS } from "./data";
import { CardLabelSchema, SuperbillLabelSchema } from "./schema";

describe("synthetic superbill specs", () => {
  it("has the ten planned cases with unique ids", () => {
    const ids = SUPERBILLS.map((s) => s.label.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  it.each(SUPERBILLS.map((s) => [s.label.id, s] as const))("%s matches the label schema", (_id, s) => {
    expect(() => SuperbillLabelSchema.parse({ ...s.label, files: ["x"] })).not.toThrow();
  });

  it.each(SUPERBILLS.map((s) => [s.label.id, s] as const))("%s totals equal the sum of its lines", (_id, s) => {
    const sum = s.label.lines.reduce((t, l) => t + l.chargeCents, 0);
    expect(s.label.totalChargedCents).toBe(sum);
    expect(s.label.totalPaidCents).toBeLessThanOrEqual(sum);
  });

  it.each(SUPERBILLS.map((s) => [s.label.id, s] as const))("%s has valid NPIs or an explicit missing flag", (_id, s) => {
    const { billingProvider, renderingProvider, expectedFlags } = s.label;
    if (billingProvider.npi) expect(isValidNpi(billingProvider.npi)).toBe(true);
    else expect(expectedFlags).toContain("missing_billing_npi");
    if (renderingProvider.npi) expect(isValidNpi(renderingProvider.npi)).toBe(true);
    else expect(expectedFlags).toContain("missing_rendering_npi");
  });

  it.each(SUPERBILLS.map((s) => [s.label.id, s] as const))("%s diagnosis pointers reference listed codes", (_id, s) => {
    for (const l of s.label.lines) {
      for (const p of l.diagnosisPointers) expect(p).toBeLessThanOrEqual(s.label.diagnosisCodes.length);
    }
  });

  it("uses only identifiers that cannot belong to a real person or business", () => {
    for (const s of SUPERBILLS) {
      const { taxId, taxIdType, phone } = s.label.billingProvider;
      if (taxIdType === "EIN") expect(taxId).toMatch(/^00-\d{7}$/);
      if (taxIdType === "SSN") expect(taxId).toMatch(/^000-\d{2}-\d{4}$/);
      if (phone) expect(phone).toMatch(/555-01\d{2}$/);
    }
  });

  it("covers every ugly case the sprint names", () => {
    const cases = new Set(SUPERBILLS.flatMap((s) => s.label.cases));
    for (const c of ["handwritten", "multi-dos", "psych-testing", "telehealth", "missing-npi"]) {
      expect(cases.has(c)).toBe(true);
    }
  });
});

describe("synthetic card specs", () => {
  it.each(CARDS.map((c) => [c.label.id, c] as const))("%s matches the label schema", (_id, c) => {
    expect(() => CardLabelSchema.parse({ ...c.label, files: ["x"] })).not.toThrow();
  });

  it("gates exactly the HMO, Medicaid and Medicare cards", () => {
    for (const c of CARDS) {
      expect(c.label.gated).toBe(["HMO", "MEDICAID", "MEDICARE"].includes(c.label.planType));
    }
    expect(CARDS.filter((c) => !c.label.gated)).toHaveLength(5);
  });
});
