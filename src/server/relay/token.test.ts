import { describe, expect, it } from "vitest";
import { issueRelayToken, RelaySecretMissing, relaySecret, TOKEN_TTL_MS, verifyRelayToken } from "./token";

const SECRET = "s".repeat(32);
const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);
const claims = { captureId: "cap_01", subject: "devRun:r1" };

describe("relay tokens", () => {
  it("verifies a fresh token and returns its binding", () => {
    const token = issueRelayToken(claims, SECRET, NOW);
    expect(verifyRelayToken(token, SECRET, NOW + TOKEN_TTL_MS)).toEqual({ ok: true, claims: { ...claims, jti: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/), exp: NOW + TOKEN_TTL_MS } });
    expect(TOKEN_TTL_MS).toBe(60_000);
  });

  it("gives every token its own jti, so the relay can refuse a reused one", () => {
    const jti = (t: string) => {
      const v = verifyRelayToken(t, SECRET, NOW);
      return v.ok ? v.claims.jti : null;
    };
    expect(jti(issueRelayToken(claims, SECRET, NOW))).not.toBe(jti(issueRelayToken(claims, SECRET, NOW)));
  });

  it("refuses a missing, expired, forged or tampered token", () => {
    const token = issueRelayToken(claims, SECRET, NOW);
    expect(verifyRelayToken(null, SECRET, NOW)).toEqual({ ok: false, code: "token_missing" });
    expect(verifyRelayToken(token, SECRET, NOW + TOKEN_TTL_MS + 1)).toEqual({ ok: false, code: "token_expired" });
    expect(verifyRelayToken(issueRelayToken(claims, "o".repeat(32), NOW), SECRET, NOW)).toEqual({ ok: false, code: "token_invalid" });
    const [, sig] = token.split(".");
    const other = issueRelayToken({ ...claims, captureId: "cap_02" }, SECRET, NOW).split(".")[0];
    expect(verifyRelayToken(`${other}.${sig}`, SECRET, NOW)).toEqual({ ok: false, code: "token_invalid" });
    expect(verifyRelayToken("garbage", SECRET, NOW)).toEqual({ ok: false, code: "token_invalid" });
  });

  it("refuses a validly signed token that claims a longer life than 60 seconds", () => {
    expect(verifyRelayToken(issueRelayToken(claims, SECRET, NOW + 5 * 60_000), SECRET, NOW)).toEqual({ ok: false, code: "token_invalid" });
  });

  it("requires a RELAY_SECRET of at least 32 characters", () => {
    expect(relaySecret({ RELAY_SECRET: SECRET })).toBe(SECRET);
    expect(() => relaySecret({})).toThrow(RelaySecretMissing);
    expect(() => relaySecret({ RELAY_SECRET: "short" })).toThrow(/RELAY_SECRET/);
  });
});
