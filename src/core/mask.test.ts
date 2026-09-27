import { describe, expect, it } from "vitest";
import { last4 } from "./mask";

describe("last4", () => {
  it("keeps only the last four characters of a Tax ID", () => {
    expect(last4("12-3456789")).toBe("6789");
    expect(last4("000-45-6789")).toBe("6789");
  });

  it("never reveals a whole value that is four characters or shorter", () => {
    expect(last4("6789")).toBe("");
    expect(last4("12")).toBe("");
    expect(last4("--")).toBe("");
  });

  it("handles empty and missing input", () => {
    expect(last4("")).toBe("");
    expect(last4(null)).toBe("");
    expect(last4(undefined)).toBe("");
  });
});
