import { describe, expect, it } from "vitest";
import { assertDevTier, deployTier } from "./deploy";

const DEV_DB = "postgres://localhost:5432/ferry_dev";

describe("assertDevTier", () => {
  it("allows the dev tier against a _dev or _test database", () => {
    expect(() => assertDevTier({ FERRY_DEPLOY_TIER: "dev", DATABASE_URL: DEV_DB })).not.toThrow();
    expect(() => assertDevTier({ DATABASE_URL: "postgres://localhost:5432/ferry_test" })).not.toThrow();
    expect(() => assertDevTier({ DATABASE_URL: "postgres://u@localhost/ferry_e2e_test?sslmode=disable" })).not.toThrow();
  });

  it.each(["prelaunch", "staging", "prod"])("refuses in the %s tier", (tier) => {
    expect(() => assertDevTier({ FERRY_DEPLOY_TIER: tier, DATABASE_URL: DEV_DB })).toThrow(/dev tier/);
  });

  it("refuses when NODE_ENV=production leaves the tier unset", () => {
    expect(() => assertDevTier({ NODE_ENV: "production", DATABASE_URL: DEV_DB })).toThrow(/FERRY_DEPLOY_TIER/);
  });

  it.each(["postgres://localhost:5432/ferry", "postgres://db.example.test:5432/ferry_prod", "postgres://localhost:5432/ferry_dev_copy"])(
    "refuses the database %s",
    (url) => {
      expect(() => assertDevTier({ FERRY_DEPLOY_TIER: "dev", DATABASE_URL: url })).toThrow(/_dev or _test/);
    },
  );

  it("refuses when DATABASE_URL is missing or unreadable", () => {
    expect(() => assertDevTier({ FERRY_DEPLOY_TIER: "dev" })).toThrow(/_dev or _test/);
    expect(() => assertDevTier({ FERRY_DEPLOY_TIER: "dev", DATABASE_URL: "not a url" })).toThrow(/_dev or _test/);
  });
});

describe("deployTier", () => {
  it("defaults to dev outside production", () => {
    expect(deployTier({})).toBe("dev");
    expect(deployTier({ NODE_ENV: "development" })).toBe("dev");
  });

  it("refuses an unknown tier by name", () => {
    expect(() => deployTier({ FERRY_DEPLOY_TIER: "production" })).toThrow(/FERRY_DEPLOY_TIER/);
  });
});
