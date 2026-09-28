import { describe, expect, it } from "vitest";
import { canDestroyTenantKey, TENANT_KEY_GRACE_DAYS } from "./retention";

const NOW = new Date("2026-11-30T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe("canDestroyTenantKey", () => {
  it.each([
    { name: "an open claim", openClaims: 1, canceledAt: daysAgo(400), expected: false },
    { name: "still a member", openClaims: 0, canceledAt: null, expected: false },
    { name: "all closed, canceled 29 days ago", openClaims: 0, canceledAt: daysAgo(29), expected: false },
    { name: "all closed, canceled 30 days ago", openClaims: 0, canceledAt: daysAgo(30), expected: true },
    { name: "all closed, canceled a year ago", openClaims: 0, canceledAt: daysAgo(365), expected: true },
    { name: "open claims, canceled 30 days ago", openClaims: 3, canceledAt: daysAgo(30), expected: false },
    { name: "canceled a second short of 30 days", openClaims: 0, canceledAt: new Date(daysAgo(30).getTime() + 1000), expected: false },
  ])("$name → $expected", ({ openClaims, canceledAt, expected }) => {
    expect(canDestroyTenantKey({ openClaims, canceledAt, now: NOW })).toBe(expected);
  });

  it("waits the 30-day export window", () => {
    expect(TENANT_KEY_GRACE_DAYS).toBe(30);
  });
});
