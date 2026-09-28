import { describe, expect, it } from "vitest";
import { consentInputs, problemParam, safeNext } from "./consent-form";

const HASH = "a".repeat(64);

describe("the re-consent form", () => {
  it("returns only to a path on this site, and never to an interstitial", () => {
    expect(safeNext("/e2e-fixtures/gated?client=cli_1", "/app")).toBe("/e2e-fixtures/gated?client=cli_1");
    expect(safeNext("/home", "/c")).toBe("/home");
    const bad = ["https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\t/\t/evil.example", "evil", "", null, 7];
    for (const v of [...bad, "/app/reconsent", "/c/reconsent?m=mbr_1", "/app/x/../reconsent"]) expect(safeNext(v, "/app"), JSON.stringify(v)).toBe("/app");
  });

  it("reads each signed text, the typed name, the signer, and the caller's address and browser", () => {
    const fd = new FormData();
    fd.append("doc", `client_filing:${HASH}`);
    fd.append("doc", "client_recording:not-a-hash");
    fd.append("doc", `password:${HASH}`);
    fd.append("typedName", "Ana Ortiz");
    fd.append("signer", "parent_guardian");
    // The caller sent 10.0.0.1 themselves; the load balancer appended the address it actually saw.
    const h = new Headers({ "x-forwarded-for": "10.0.0.1, 203.0.113.7", "user-agent": "Mozilla/5.0" });
    expect(consentInputs(fd, h)).toEqual([{ docType: "client_filing", shownHash: HASH, typedName: "Ana Ortiz", signerRelationship: "parent_guardian", ip: "203.0.113.7", userAgent: "Mozilla/5.0" }]);
    fd.set("signer", "friend");
    expect(consentInputs(fd, new Headers())[0]).toMatchObject({ signerRelationship: undefined, ip: null, userAgent: null });
  });

  it("shows only a known problem", () => {
    expect(problemParam("minor_self")).toBe("minor_self");
    expect(problemParam("<script>")).toBeUndefined();
  });
});
