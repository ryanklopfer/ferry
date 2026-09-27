import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./api/dev/manifest/route";
import { generateMetadata } from "./dev/mic/page";
import manifest from "./manifest";

const K = randomBytes(32).toString("base64url");

function env(tier: string | undefined, k: string | undefined) {
  vi.stubEnv("FERRY_DEPLOY_TIER", tier);
  vi.stubEnv("FERRY_SPIKE_K", k);
}

const keyed = (query: string) => GET(new Request(`http://localhost:3000/api/dev/manifest${query}`));

afterEach(() => vi.unstubAllEnvs());

describe("the shared manifest, served signed out", () => {
  it.each(["dev", "prelaunch", "staging", "prod"])("starts at /home and never carries the spike key, even with FERRY_SPIKE_K in the %s tier", (tier) => {
    env(tier, K);
    const m = manifest();
    expect(m.start_url).toBe("/home");
    expect(JSON.stringify(m)).not.toContain(K);
  });
});

describe("the spike manifest /dev/mic links", () => {
  it("starts at /dev/mic?k=… with FERRY_SPIKE_K in the dev tier and a valid k", async () => {
    env("dev", K);
    const res = keyed(`?k=${K}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ id: "/dev/mic", start_url: `/dev/mic?k=${K}`, scope: "/", display: "standalone" });
  });

  it.each([
    ["no k", "dev", K, ""],
    ["a wrong k", "dev", K, `?k=${randomBytes(32).toString("base64url")}`],
    ["no FERRY_SPIKE_K", "dev", undefined, `?k=${K}`],
    ["a FERRY_SPIKE_K under 32 characters", "dev", "abc", "?k=abc"],
    ["the prelaunch tier", "prelaunch", K, `?k=${K}`],
    ["the staging tier", "staging", K, `?k=${K}`],
    ["the prod tier", "prod", K, `?k=${K}`],
  ])("is 404 with %s", (_label, tier, k, query) => {
    env(tier, k);
    expect(keyed(query).status).toBe(404);
  });

  it("answers other methods 404", () => {
    env("dev", K);
    expect(POST().status).toBe(404);
  });

  it("is what /dev/mic links, only with a valid k", async () => {
    env("dev", K);
    expect((await generateMetadata({ searchParams: Promise.resolve({ k: K }) })).manifest).toBe(`/api/dev/manifest?k=${K}`);
    expect((await generateMetadata({ searchParams: Promise.resolve({}) })).manifest).toBeUndefined();
    env("prod", K);
    expect((await generateMetadata({ searchParams: Promise.resolve({ k: K }) })).manifest).toBeUndefined();
  });
});
