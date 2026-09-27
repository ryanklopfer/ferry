import { describe, expect, it } from "vitest";
import { assertBootable, BootRefused } from "./boot";
import { modeEnvVar, VENDORS, type Vendor } from "./integrations/mode";

const allModes = (mode: string) => Object.fromEntries(VENDORS.map((v) => [modeEnvVar(v), mode]));
const env = (tier: string, mode: string, extra: Record<string, string> = {}) => ({ NODE_ENV: "production", FERRY_DEPLOY_TIER: tier, ...allModes(mode), ...extra });
const one = (tier: string, base: string, vendor: Vendor, mode: string, extra: Record<string, string> = {}) => env(tier, base, { [modeEnvVar(vendor)]: mode, ...extra });

function refusal(e: Record<string, string | undefined>): BootRefused | null {
  try {
    assertBootable(e);
    return null;
  } catch (err) {
    if (err instanceof BootRefused) return err;
    throw err;
  }
}

describe("assertBootable", () => {
  it("boots each tier in its intended shape", () => {
    expect(refusal({})).toBeNull();
    expect(refusal({ NODE_ENV: "development", ...allModes("fixture") })).toBeNull();
    expect(refusal({ FERRY_DEPLOY_TIER: "prelaunch", NODE_ENV: "production" })).toBeNull();
    expect(refusal(env("staging", "test"))).toBeNull();
    expect(refusal(env("prod", "live"))).toBeNull();
  });

  describe("prod", () => {
    const cases = VENDORS.flatMap((vendor) => ["fixture", "test", "local", "off"].map((mode) => ({ vendor, mode })));
    it.each(cases)("$vendor in mode $mode", ({ vendor, mode }) => {
      const r = refusal(one("prod", "live", vendor, mode));
      if (mode === "off" && (vendor === "sms" || vendor === "fax")) return expect(r).toBeNull();
      expect(r?.failures).toEqual([expect.stringMatching(new RegExp(`^${vendor}: .*${mode}`))]);
    });
  });

  describe("staging", () => {
    it.each(VENDORS.flatMap((vendor) => ["fixture", "local"].map((mode) => ({ vendor, mode }))))("refuses $vendor in mode $mode", ({ vendor, mode }) => {
      expect(refusal(one("staging", "live", vendor, mode))?.failures).toEqual([expect.stringMatching(new RegExp(`^${vendor}: .*${mode}`))]);
    });

    it.each(VENDORS.flatMap((vendor) => ["live", "test", "off"].map((mode) => ({ vendor, mode }))))("accepts $vendor in mode $mode", ({ vendor, mode }) => {
      expect(refusal(one("staging", "live", vendor, mode))).toBeNull();
    });

    it.each(["deidentified", "real"])("refuses data class %s", (dataClass) => {
      expect(refusal(env("staging", "live", { FERRY_DATA_CLASS: dataClass }))?.failures).toEqual([expect.stringMatching(/FERRY_DATA_CLASS/)]);
    });

    it("accepts synthetic data", () => {
      expect(refusal(env("staging", "live", { FERRY_DATA_CLASS: "synthetic" }))).toBeNull();
    });
  });

  describe("prelaunch", () => {
    it.each(VENDORS.flatMap((vendor) => ["live", "test", "fixture", "local"].map((mode) => ({ vendor, mode }))))("refuses $vendor in mode $mode", ({ vendor, mode }) => {
      expect(refusal(one("prelaunch", "off", vendor, mode))?.failures).toEqual([expect.stringMatching(new RegExp(`^${vendor}: .*${mode}`))]);
    });
  });

  it("refuses NODE_ENV=production without FERRY_DEPLOY_TIER", () => {
    expect(refusal({ NODE_ENV: "production", ...allModes("live") })?.failures).toEqual([expect.stringMatching(/FERRY_DEPLOY_TIER/)]);
  });

  it("names every refused vendor in one error", () => {
    const r = refusal(env("prod", "fixture"));
    expect(r?.failures.map((f) => f.split(":")[0]).sort()).toEqual([...VENDORS].sort());
    for (const vendor of VENDORS) expect(r?.message).toContain(`${vendor}:`);
  });
});
