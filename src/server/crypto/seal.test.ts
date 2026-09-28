import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { type DataKey, isSealed, keyIdOf, open, seal, SealError } from "./aead";
import { blindIndex } from "./blind";

const key: DataKey = { id: "t-0123456789abcdef", bytes: randomBytes(32) };
const PLAINTEXT = JSON.stringify("Marisol Quintero");

// Flips one bit in one byte of one base64url part, keeping the rest of the value intact.
function flip(value: string, part: 2 | 3 | 4, byte = 0): string {
  const parts = value.split(".");
  const bytes = Buffer.from(parts[part], "base64url");
  bytes[byte] ^= 0x01;
  parts[part] = bytes.toString("base64url");
  return parts.join(".");
}

describe("seal and open", () => {
  it("round-trips and names its key", () => {
    const sealed = seal(key, PLAINTEXT);
    expect(sealed).toMatch(/^v1\.t-0123456789abcdef\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(isSealed(sealed)).toBe(true);
    expect(keyIdOf(sealed)).toBe(key.id);
    expect(open(key, sealed)).toBe(PLAINTEXT);
    expect(sealed).not.toContain("Marisol");
  });

  it("fails to open when one ciphertext byte is flipped", () => {
    const sealed = seal(key, PLAINTEXT);
    const ctLength = Buffer.from(sealed.split(".")[3], "base64url").length;
    for (let i = 0; i < ctLength; i++) expect(() => open(key, flip(sealed, 3, i)), `byte ${i}`).toThrow(SealError);
  });

  it("fails to open when the iv or the tag is flipped", () => {
    const sealed = seal(key, PLAINTEXT);
    expect(() => open(key, flip(sealed, 2))).toThrow(SealError);
    expect(() => open(key, flip(sealed, 4))).toThrow(SealError);
  });

  it("gives two different values for two seals of the same plaintext", () => {
    const a = seal(key, PLAINTEXT);
    const b = seal(key, PLAINTEXT);
    expect(a).not.toBe(b);
    expect(a.split(".")[2]).not.toBe(b.split(".")[2]);
    expect(open(key, a)).toBe(open(key, b));
  });

  it("refuses another key, a relabelled value and a different context", () => {
    const sealed = seal(key, PLAINTEXT, "tenant:usr_a");
    expect(() => open({ id: key.id, bytes: randomBytes(32) }, sealed, "tenant:usr_a")).toThrow(SealError);
    expect(() => open({ id: "t-other", bytes: key.bytes }, sealed, "tenant:usr_a")).toThrow(/another key/);
    expect(() => open({ id: "t-other", bytes: key.bytes }, sealed.replace(key.id, "t-other"), "tenant:usr_a")).toThrow(SealError);
    expect(() => open(key, sealed, "tenant:usr_b")).toThrow(SealError);
    expect(open(key, sealed, "tenant:usr_a")).toBe(PLAINTEXT);
  });

  it("refuses values that are not sealed", () => {
    expect(() => open(key, "Marisol")).toThrow(SealError);
    expect(() => open(key, "v2.t-1.a.b.c")).toThrow(SealError);
    expect(isSealed("F33.1")).toBe(false);
  });
});

describe("blindIndex", () => {
  const indexKey = randomBytes(32);

  it("is deterministic over the normalized value and hides it", () => {
    const a = blindIndex(indexKey, "clients.email", "email", "Marisol.Q@Example.test ");
    expect(a).toBe(blindIndex(indexKey, "clients.email", "email", "marisol.q@example.test"));
    expect(a).not.toContain("marisol");
    expect(blindIndex(indexKey, "plans.member_id", "memberId", "w884-120 7733")).toBe(blindIndex(indexKey, "plans.member_id", "memberId", "W8841207733"));
  });

  it("differs by key and by purpose", () => {
    const a = blindIndex(indexKey, "clients.email", "email", "m@example.test");
    expect(blindIndex(randomBytes(32), "clients.email", "email", "m@example.test")).not.toBe(a);
    expect(blindIndex(indexKey, "clients.phone", "email", "m@example.test")).not.toBe(a);
  });
});
