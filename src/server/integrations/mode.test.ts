import { describe, expect, it } from "vitest";
import { TIERS, type Tier } from "@/server/deploy";
import { MODES, type Mode, modeEnvVar, modeFor, VENDORS, type Vendor, VendorOff, vendorOff } from "./mode";

// The spec, written out independently of the implementation.
function expected(tier: Tier, vendor: Vendor, mode: Mode): boolean {
  if (tier === "dev") return true;
  if (tier === "prelaunch") return mode === "off";
  if (tier === "staging") return mode === "live" || mode === "test" || mode === "off";
  return mode === "live" || (mode === "off" && (vendor === "sms" || vendor === "fax"));
}

const defaultFor = (tier: Tier): Mode => (tier === "dev" ? "fixture" : "off");

const OVERRIDES = [undefined, ...MODES] as const;
const rows = VENDORS.flatMap((vendor) => TIERS.flatMap((tier) => OVERRIDES.map((override) => ({ vendor, tier, override }))));

describe("modeFor", () => {
  it("covers every vendor the plan names", () => {
    expect([...VENDORS].sort()).toEqual(["billing", "clearinghouse", "email", "ephemeralKeys", "fax", "keys", "llm", "nppes", "scribe", "sms", "storage"]);
    expect(modeEnvVar("ephemeralKeys")).toBe("FERRY_EPHEMERAL_KEYS_MODE");
    expect(modeEnvVar("email")).toBe("FERRY_EMAIL_MODE");
  });

  it.each(rows)("$vendor in $tier with override $override", ({ vendor, tier, override }) => {
    const env = { FERRY_DEPLOY_TIER: tier, [modeEnvVar(vendor)]: override };
    const mode = override ?? defaultFor(tier);
    if (expected(tier, vendor, mode)) {
      expect(modeFor(vendor, env)).toBe(mode);
    } else {
      expect(() => modeFor(vendor, env)).toThrow(new RegExp(`${vendor}.*${mode}.*${tier}`));
    }
  });

  it("accepts off only where the tier allows it", () => {
    const allowsOff = (tier: Tier, vendor: Vendor) => {
      try {
        return modeFor(vendor, { FERRY_DEPLOY_TIER: tier, [modeEnvVar(vendor)]: "off" }) === "off";
      } catch {
        return false;
      }
    };
    for (const vendor of VENDORS) {
      expect(allowsOff("dev", vendor)).toBe(true);
      expect(allowsOff("prelaunch", vendor)).toBe(true);
      expect(allowsOff("staging", vendor)).toBe(true);
      expect(allowsOff("prod", vendor)).toBe(vendor === "sms" || vendor === "fax");
    }
  });

  it("refuses an unknown mode by its variable name", () => {
    expect(() => modeFor("email", { FERRY_EMAIL_MODE: "sandbox" })).toThrow(/FERRY_EMAIL_MODE/);
  });

  it("throws VendorOff, naming the vendor, when an off vendor is called", () => {
    expect(() => vendorOff("fax")).toThrow(VendorOff);
    expect(() => vendorOff("fax")).toThrow(/fax/);
  });
});
