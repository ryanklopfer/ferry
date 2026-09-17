import { describe, expect, it } from "vitest";
import { isValidNpi, npiFromBase } from "./npi";

describe("isValidNpi", () => {
  it("accepts the CMS example NPI", () => {
    expect(isValidNpi("1234567893")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidNpi("1234567890")).toBe(false);
  });

  it("rejects anything that is not exactly 10 digits", () => {
    expect(isValidNpi("123456789")).toBe(false);
    expect(isValidNpi("12345678931")).toBe(false);
    expect(isValidNpi("12345a7893")).toBe(false);
    expect(isValidNpi("")).toBe(false);
  });

  it("rejects NPIs that do not start with 1 or 2", () => {
    expect(isValidNpi(npiFromBase("312345678"))).toBe(false);
  });
});

describe("npiFromBase", () => {
  it("appends the Luhn check digit computed with the 80840 prefix", () => {
    expect(npiFromBase("123456789")).toBe("1234567893");
  });

  it("produces NPIs that validate", () => {
    for (const base of ["199900001", "199900002", "299900003"]) {
      expect(isValidNpi(npiFromBase(base))).toBe(true);
    }
  });

  it("throws on a base that is not 9 digits", () => {
    expect(() => npiFromBase("12345")).toThrow();
  });
});
