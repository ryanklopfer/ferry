import { describe, expect, it } from "vitest";
import { APP_ICONS, type AppIcon } from "@/core/pwa/icons";
import { isPlaceholderAddress, SITE } from "@/core/site";
import { assertBootable, BootRefused } from "./boot";
import { ephemeralKeyStoreFor, keyProviderFor } from "./crypto";
import { localEphemeralKeyStore } from "./crypto/ephemeral";
import { localKeyProvider } from "./crypto/key-provider";
import { modeEnvVar, VENDORS, type Vendor } from "./integrations/mode";

const allModes = (mode: string) => Object.fromEntries(VENDORS.map((v) => [modeEnvVar(v), mode]));
const DEV_DB = { DATABASE_URL: "postgres://localhost:5432/ferry_dev" };
const env = (tier: string, mode: string, extra: Record<string, string> = {}) => ({ NODE_ENV: "production", FERRY_DEPLOY_TIER: tier, FERRY_DATA_CLASS: "synthetic", ...allModes(mode), ...extra });
const one = (tier: string, base: string, vendor: Vendor, mode: string, extra: Record<string, string> = {}) => env(tier, base, { [modeEnvVar(vendor)]: mode, ...extra });

// The approved artwork (F11) has not landed, so tier rules other than the icon check are tested as if it had.
const FINAL_ICONS: AppIcon[] = APP_ICONS.map((i) => ({ ...i, placeholder: false }));
// Likewise the contact address (an S11c founder blocker).
const FINAL_CONTACT = "hello@ferry.health";

function refusal(e: Record<string, string | undefined>, icons: readonly AppIcon[] = FINAL_ICONS, contact = FINAL_CONTACT): BootRefused | null {
  try {
    assertBootable(e, icons, contact);
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
        assertBootable(env("prod", "live"), undefined, FINAL_CONTACT);
      } catch (e) {
        refused = e instanceof BootRefused;
      }
      expect(refused).toBe(APP_ICONS.some((i) => i.placeholder));
    });
  });

  describe("contact address", () => {
    const PRELAUNCH = { FERRY_DEPLOY_TIER: "prelaunch", NODE_ENV: "production" };
    const PLACEHOLDER = "hello@ferry.example";

    it("a public host refuses to boot with the placeholder: the prelaunch and prod tiers, or FERRY_PRELAUNCH=1 in staging", () => {
      for (const e of [PRELAUNCH, env("prod", "live"), env("prod", "live", { FERRY_PRELAUNCH: "1" }), env("staging", "test", { FERRY_PRELAUNCH: "1" })]) {
        expect(refusal(e, FINAL_ICONS, PLACEHOLDER)?.failures, e.FERRY_DEPLOY_TIER).toEqual([expect.stringMatching(/^site: .*hello@ferry\.example.*placeholder/)]);
      }
    });

    it("a local prelaunch run may opt in, and only in the prelaunch tier", () => {
      expect(refusal({ ...PRELAUNCH, FERRY_ALLOW_PLACEHOLDER_CONTACT: "1" }, FINAL_ICONS, PLACEHOLDER)).toBeNull();
      expect(refusal(env("prod", "live", { FERRY_ALLOW_PLACEHOLDER_CONTACT: "1" }), FINAL_ICONS, PLACEHOLDER)?.failures).toEqual([expect.stringMatching(/^site: /)]);
    });

    it("staging and dev allow it", () => {
      expect(refusal(env("staging", "test"), FINAL_ICONS, PLACEHOLDER)).toBeNull();
      expect(refusal({ ...DEV_DB, FERRY_PRELAUNCH: "1" }, FINAL_ICONS, PLACEHOLDER)).toBeNull();
    });

    it("knows the reserved names that never receive mail", () => {
      for (const bad of [PLACEHOLDER, "a@example.com", "a@mail.example.org", "a@x.test", "a@x.invalid", "a@localhost.localhost"]) expect(isPlaceholderAddress(bad), bad).toBe(true);
      for (const ok of [FINAL_CONTACT, "a@examples.com", "a@notexample.com"]) expect(isPlaceholderAddress(ok), ok).toBe(false);
    });

    it("checks the real address by default", () => {
      let refused = false;
      try {
        assertBootable(PRELAUNCH);
      } catch (e) {
        refused = e instanceof BootRefused;
      }
      expect(refused).toBe(isPlaceholderAddress(SITE.contactEmail));
    });
  });

  it("FERRY_PRELAUNCH must be 0, 1 or unset, so a typo can't leave the full app up", () => {
    for (const value of ["true", "yes", "on", "2"]) expect(refusal(env("prod", "live", { FERRY_PRELAUNCH: value }))?.failures, value).toEqual(["FERRY_PRELAUNCH must be 1 (public pages only), 0 or unset"]);
    for (const value of ["0", "1", ""]) expect(refusal(env("prod", "live", { FERRY_PRELAUNCH: value })), value).toBeNull();
  });

  it("names every refused vendor in one error", () => {
    const r = refusal(env("prod", "fixture"));
    expect(r?.failures.map((f) => f.split(":")[0]).sort()).toEqual([...VENDORS].sort());
    for (const vendor of VENDORS) expect(r?.message).toContain(`${vendor}:`);
  });

  describe("local key providers", () => {
    const KEK = { FERRY_LOCAL_KEK: Buffer.alloc(32, 7).toString("base64"), FERRY_KEY_DIR: "/nonexistent/ferry-keys" };

    it.each(["prelaunch", "staging", "prod"])("boot refuses local and fixture keys and ephemeral keys in the %s tier", (tier) => {
      const base = tier === "prelaunch" ? "off" : "live";
      for (const vendor of ["keys", "ephemeralKeys"] as const) {
        for (const mode of ["local", "fixture"]) expect(refusal(one(tier, base, vendor, mode))?.failures, `${vendor} ${mode}`).toEqual([expect.stringMatching(new RegExp(`^${vendor}: mode ${mode} is not allowed in the ${tier} tier`))]);
      }
    });

    it.each(["prelaunch", "staging", "prod"])("the local providers refuse to construct in the %s tier, even when called directly", (tier) => {
      const e = { FERRY_DEPLOY_TIER: tier, NODE_ENV: "production", ...KEK };
      expect(() => localKeyProvider(e)).toThrow(/dev tier/);
      expect(() => localEphemeralKeyStore(e)).toThrow(/dev tier/);
      expect(() => keyProviderFor({ ...e, FERRY_KEYS_MODE: "local" })).toThrow(/not allowed/);
      expect(() => ephemeralKeyStoreFor({ ...e, FERRY_EPHEMERAL_KEYS_MODE: "local" })).toThrow(/not allowed/);
    });

    it("the dev tier boots them by default", async () => {
      expect(refusal({ ...DEV_DB, FERRY_KEYS_MODE: "local", FERRY_EPHEMERAL_KEYS_MODE: "local" })).toBeNull();
      const provider = keyProviderFor({ ...DEV_DB, ...KEK });
      const key = Buffer.alloc(64, 1);
      expect(await provider.unwrap(await provider.wrap(key, { tenantId: "usr_x" }), { tenantId: "usr_x" })).toEqual(key);
      expect(() => ephemeralKeyStoreFor({ ...DEV_DB, ...KEK })).not.toThrow();
    });

    it("the AWS modes wait for S21a's clients rather than falling back to local keys", () => {
      expect(() => keyProviderFor({ ...env("staging", "live") })).toThrow(/keys has no live implementation/);
      expect(() => ephemeralKeyStoreFor({ ...env("prod", "live") })).toThrow(/ephemeralKeys has no live implementation/);
      expect(() => keyProviderFor({ FERRY_DEPLOY_TIER: "prelaunch", NODE_ENV: "production" })).toThrow(/keys is off/);
    });
  });
});
