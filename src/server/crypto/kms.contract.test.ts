import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { awsKmsKeyProvider, type KeyProvider, type KmsApi, localKeyProvider } from "./key-provider";

const KEY_ARN = "arn:aws:kms:us-east-1:000000000000:key/00000000-0000-0000-0000-000000000000";

class InvalidCiphertextException extends Error {
  name = "InvalidCiphertextException";
}

// Behaves like KMS for Encrypt/Decrypt: the ciphertext names its key, and Decrypt fails unless the encryption
// context matches exactly. Nothing leaves the process.
function mockKms() {
  const master = randomBytes(32);
  const calls: { op: "encrypt" | "decrypt"; KeyId: string; EncryptionContext: Record<string, string> }[] = [];
  const aad = (keyId: string, ctx: Record<string, string>) => Buffer.from(JSON.stringify([keyId, Object.entries(ctx).sort()]));
  const kms: KmsApi = {
    async encrypt({ KeyId, Plaintext, EncryptionContext }) {
      calls.push({ op: "encrypt", KeyId, EncryptionContext });
      if (KeyId !== KEY_ARN) throw new Error("NotFoundException");
      const iv = randomBytes(12);
      const c = createCipheriv("aes-256-gcm", master, iv).setAAD(aad(KeyId, EncryptionContext));
      const ct = Buffer.concat([c.update(Plaintext), c.final()]);
      return { CiphertextBlob: Buffer.concat([iv, c.getAuthTag(), ct]), KeyId };
    },
    async decrypt({ KeyId, CiphertextBlob, EncryptionContext }) {
      calls.push({ op: "decrypt", KeyId, EncryptionContext });
      const blob = Buffer.from(CiphertextBlob);
      try {
        const d = createDecipheriv("aes-256-gcm", master, blob.subarray(0, 12)).setAAD(aad(KeyId, EncryptionContext));
        d.setAuthTag(blob.subarray(12, 28));
        return { Plaintext: Buffer.concat([d.update(blob.subarray(28)), d.final()]), KeyId };
      } catch {
        throw new InvalidCiphertextException();
      }
    },
  };
  return { kms, calls };
}

// Flips one bit in the middle of the ciphertext, whether it is a v1 sealed value or a bare base64 blob.
function tamper(wrapped: string): string {
  const parts = wrapped.split(".");
  const i = parts.length === 5 ? 3 : 0;
  const bytes = Buffer.from(parts[i], parts.length === 5 ? "base64url" : "base64");
  bytes[Math.floor(bytes.length / 2)] ^= 1;
  parts[i] = bytes.toString(parts.length === 5 ? "base64url" : "base64");
  return parts.join(".");
}

// Every KeyProvider keeps these promises; the aws-kms one is held to them against the mock.
function keyProviderContract(name: string, make: () => KeyProvider) {
  describe(`${name} KeyProvider contract`, () => {
    it("unwraps what it wrapped, for the same tenant", async () => {
      const p = make();
      const key = randomBytes(64);
      const wrapped = await p.wrap(key, { tenantId: "usr_x" });
      expect(Buffer.compare(await p.unwrap(wrapped, { tenantId: "usr_x" }), key)).toBe(0);
    });

    it("never stores the key in the clear, and wraps it differently each time", async () => {
      const p = make();
      const key = randomBytes(64);
      const a = await p.wrap(key, { tenantId: "usr_x" });
      const b = await p.wrap(key, { tenantId: "usr_x" });
      for (const enc of ["base64", "base64url", "hex"] as const) expect(a.wrapped).not.toContain(key.subarray(0, 24).toString(enc));
      expect(a.wrapped).not.toBe(b.wrapped);
    });

    it("refuses to unwrap for another tenant", async () => {
      const p = make();
      const wrapped = await p.wrap(randomBytes(64), { tenantId: "usr_x" });
      await expect(p.unwrap(wrapped, { tenantId: "usr_y" })).rejects.toThrow();
    });

    it("refuses a tampered wrapped key", async () => {
      const p = make();
      const wrapped = await p.wrap(randomBytes(64), { tenantId: "usr_x" });
      const tampered = tamper(wrapped.wrapped);
      await expect(p.unwrap({ ...wrapped, wrapped: tampered }, { tenantId: "usr_x" })).rejects.toThrow();
    });
  });
}

keyProviderContract("local", () => localKeyProvider({ FERRY_DEPLOY_TIER: "dev", FERRY_LOCAL_KEK: randomBytes(32).toString("base64") }));
keyProviderContract("aws-kms (mocked client)", () => awsKmsKeyProvider(mockKms().kms, KEY_ARN));

describe("aws-kms KeyProvider", () => {
  it("encrypts under the configured key with the tenant in the encryption context", async () => {
    const { kms, calls } = mockKms();
    const p = awsKmsKeyProvider(kms, KEY_ARN);
    const wrapped = await p.wrap(randomBytes(64), { tenantId: "usr_x" });
    await p.unwrap(wrapped, { tenantId: "usr_x" });
    expect(wrapped.kekRef).toBe(KEY_ARN);
    expect(calls).toEqual([
      { op: "encrypt", KeyId: KEY_ARN, EncryptionContext: { purpose: "ferry-tenant-key", tenant: "usr_x" } },
      { op: "decrypt", KeyId: KEY_ARN, EncryptionContext: { purpose: "ferry-tenant-key", tenant: "usr_x" } },
    ]);
  });

  it("surfaces KMS refusing the context as an error, never as a key", async () => {
    const { kms } = mockKms();
    const p = awsKmsKeyProvider(kms, KEY_ARN);
    const wrapped = await p.wrap(randomBytes(64), { tenantId: "usr_x" });
    await expect(p.unwrap(wrapped, { tenantId: "usr_y" })).rejects.toThrow(InvalidCiphertextException);
  });

  it("refuses an empty KMS response", async () => {
    const p = awsKmsKeyProvider({ encrypt: async () => ({}), decrypt: async () => ({}) }, KEY_ARN);
    await expect(p.wrap(randomBytes(64), { tenantId: "usr_x" })).rejects.toThrow(/no ciphertext/);
    await expect(p.unwrap({ kekRef: KEY_ARN, wrapped: "AAAA" }, { tenantId: "usr_x" })).rejects.toThrow(/no plaintext/);
  });
});
