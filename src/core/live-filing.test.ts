import { describe, expect, it } from "vitest";
import { liveFilingAllowed } from "./clinician";

const matches = [true, false, null] as const;
const verified = [new Date("2026-10-12T15:00:00Z"), null] as const;
const placeholders = [false, true] as const;

describe("liveFilingAllowed", () => {
  const table = matches.flatMap((nppesNameMatch) => verified.flatMap((identityVerifiedAt) => placeholders.map((authorizationPlaceholder) => ({ nppesNameMatch, identityVerifiedAt, authorizationPlaceholder }))));

  it("covers every combination of NPPES name match, identity check and placeholder authorization", () => {
    expect(table).toHaveLength(12);
  });

  it.each(table)("nppes_name_match=$nppesNameMatch identity_verified_at=$identityVerifiedAt placeholder=$authorizationPlaceholder", ({ nppesNameMatch, identityVerifiedAt, authorizationPlaceholder }) => {
    const all = nppesNameMatch === true && identityVerifiedAt !== null && !authorizationPlaceholder;
    expect(liveFilingAllowed({ nppesNameMatch, identityVerifiedAt }, { authorizationPlaceholder })).toBe(all);
  });

  it("is true only when all three pass", () => {
    expect(table.filter((r) => liveFilingAllowed(r, r))).toEqual([{ nppesNameMatch: true, identityVerifiedAt: verified[0], authorizationPlaceholder: false }]);
  });
});
