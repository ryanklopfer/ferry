import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifest, * as route from "./manifest";

const K = randomBytes(32).toString("base64url");

function env(tier: string | undefined, k: string | undefined) {
  vi.stubEnv("FERRY_DEPLOY_TIER", tier);
  vi.stubEnv("FERRY_SPIKE_K", k);
}

afterEach(() => vi.unstubAllEnvs());

describe("manifest start_url", () => {
  it("opens the mic spike when FERRY_SPIKE_K is set in the dev tier", () => {
    env("dev", K);
    expect(manifest().start_url).toBe(`/dev/mic?k=${K}`);
  });

  it("is /home without FERRY_SPIKE_K", () => {
    env("dev", undefined);
    expect(manifest().start_url).toBe("/home");
  });

  it.each(["prelaunch", "staging", "prod"])("is /home in the %s tier even with FERRY_SPIKE_K", (tier) => {
    env(tier, K);
    expect(manifest().start_url).toBe("/home");
  });

  it("is /home when FERRY_SPIKE_K is too short to be a per-run key", () => {
    env("dev", "abc");
    expect(manifest().start_url).toBe("/home");
  });

  it("is rendered per request, so a key in the build environment is never baked into a built manifest", () => {
    expect(route.dynamic).toBe("force-dynamic");
  });
});
