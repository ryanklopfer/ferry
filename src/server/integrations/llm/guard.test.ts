import { describe, expect, it } from "vitest";
import { assertSyntheticDirectApi, DirectApiRefused } from "./guard";

const REFUSED = [
  { FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "" },
  { FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "deidentified" },
  { FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "real" },
  { FERRY_DEPLOY_TIER: "prelaunch", FERRY_DATA_CLASS: "synthetic" },
  { FERRY_DEPLOY_TIER: "staging", FERRY_DATA_CLASS: "synthetic" },
  { FERRY_DEPLOY_TIER: "prod", FERRY_DATA_CLASS: "synthetic" },
  { FERRY_DEPLOY_TIER: "prod", FERRY_DATA_CLASS: "real" },
];

describe("assertSyntheticDirectApi", () => {
  it.each(REFUSED)("refuses tier $FERRY_DEPLOY_TIER with data class $FERRY_DATA_CLASS", (env) => {
    expect(() => assertSyntheticDirectApi(env)).toThrow(DirectApiRefused);
  });

  it("allows synthetic data in the dev tier", () => {
    expect(() => assertSyntheticDirectApi({ FERRY_DEPLOY_TIER: "dev", FERRY_DATA_CLASS: "synthetic" })).not.toThrow();
  });

  it("refuses when FERRY_DATA_CLASS was never declared", () => {
    expect(() => assertSyntheticDirectApi({})).toThrow(/data class is real/);
    expect(() => assertSyntheticDirectApi({ FERRY_DEPLOY_TIER: "dev" })).toThrow(DirectApiRefused);
  });
});
