import { describe, expect, it } from "vitest";
import { APP_ICONS, type AppIcon } from "@/core/pwa/icons";
import { assertBootable, BootRefused } from "./boot";
import { modeEnvVar, VENDORS, type Vendor } from "./integrations/mode";

const allModes = (mode: string) => Object.fromEntries(VENDORS.map((v) => [modeEnvVar(v), mode]));
const DEV_DB = { DATABASE_URL: "postgres://localhost:5432/ferry_dev" };
const env = (tier: string, mode: string, extra: Record<string, string> = {}) => ({ NODE_ENV: "production", FERRY_DEPLOY_TIER: tier, FERRY_DATA_CLASS: "synthetic", ...allModes(mode), ...extra });
const one = (tier: string, base: string, vendor: Vendor, mode: string, extra: Record<string, string> = {}) => env(tier, base, { [modeEnvVar(vendor)]: mode, ...extra });

// The approved artwork (F11) has not landed, so tier rules other than the icon check are tested as if it had.
const FINAL_ICONS: AppIcon[] = APP_ICONS.map((i) => ({ ...i, placeholder: false }));

function refusal(e: Record<string, string | undefined>, icons: readonly AppIcon[] = FINAL_ICONS): BootRefused | null {
  try {
    assertBootable(e, icons);
    return null;
  } catch (err) {
    if (err instanceof BootRefused) return err;
    throw err;
  }
}

describe("assertBootable", () => {
  it("boots each tier in its intended shape", () => {
    expect(refusal(DEV_DB)).toBeNull();
    expect(refusal({ NODE_ENV: "development", ...DEV_DB, ...allModes("fixture") })).toBeNull();
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

    it("refuses an undeclared data class", () => {
      expect(refusal(env("staging", "live", { FERRY_DATA_CLASS: "" }))?.failures).toEqual([expect.stringMatching(/FERRY_DATA_CLASS/)]);
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

  describe("dev", () => {
    it.each(["postgres://db.internal:5432/ferry", "postgres://localhost:5432/ferry_prod", "not a url", undefined])("refuses database %s", (url) => {
      expect(refusal({ FERRY_DEPLOY_TIER: "dev", NODE_ENV: "production", DATABASE_URL: url })?.failures).toEqual([expect.stringMatching(/_dev or _test/)]);
    });

    it("accepts the e2e database", () => {
      expect(refusal({ FERRY_DEPLOY_TIER: "dev", DATABASE_URL: "postgres://localhost:5432/ferry_e2e_test" })).toBeNull();
    });
  });

  it("refuses NODE_ENV=production without FERRY_DEPLOY_TIER", () => {
    expect(refusal({ NODE_ENV: "production", ...allModes("live") })?.failures).toEqual([expect.stringMatching(/FERRY_DEPLOY_TIER/)]);
  });

  describe("app icons", () => {
    const withPlaceholder = FINAL_ICONS.map((i, n) => (n === 1 ? { ...i, placeholder: true } : i));

    it("the prod tier refuses to boot while any icon is flagged placeholder", () => {
      expect(refusal(env("prod", "live"), withPlaceholder)?.failures).toEqual([expect.stringMatching(/^icons: .*placeholder.*\/icons\/icon-512\.png/)]);
      expect(refusal(env("prod", "live"), APP_ICONS)?.failures).toEqual([expect.stringMatching(/^icons: /)]);
    });

    it("the prelaunch tier allows placeholder icons", () => {
      expect(refusal({ FERRY_DEPLOY_TIER: "prelaunch", NODE_ENV: "production" }, APP_ICONS)).toBeNull();
    });

    it("staging and dev allow placeholder icons", () => {
      expect(refusal(env("staging", "test"), APP_ICONS)).toBeNull();
      expect(refusal(DEV_DB, APP_ICONS)).toBeNull();
    });

    it("the prod tier boots once every icon is final", () => {
      expect(refusal(env("prod", "live"), FINAL_ICONS)).toBeNull();
    });

    it("checks the real icon list by default", () => {
      let refused = false;
      try {
        assertBootable(env("prod", "live"));
      } catch (e) {
        refused = e instanceof BootRefused;
      }
      expect(refused).toBe(APP_ICONS.some((i) => i.placeholder));
    });
  });

  it("names every refused vendor in one error", () => {
    const r = refusal(env("prod", "fixture"));
    expect(r?.failures.map((f) => f.split(":")[0]).sort()).toEqual([...VENDORS].sort());
    for (const vendor of VENDORS) expect(r?.message).toContain(`${vendor}:`);
  });
});
