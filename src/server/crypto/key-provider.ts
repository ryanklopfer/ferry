import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DeployConfigError, deployTier, type Env } from "@/server/deploy";
import { openBytes, sealBytes } from "./aead";

// Wraps and unwraps tenant data keys under a key-encryption key. The tenant id is bound into every wrap
// (AAD locally, the encryption context in KMS), so a wrapped key copied to another tenant's row won't unwrap.
export type WrappedKey = { kekRef: string; wrapped: string };
export type KeyContext = { tenantId: string };
export interface KeyProvider {
  wrap(key: Buffer, context: KeyContext): Promise<WrappedKey>;
  unwrap(wrapped: WrappedKey, context: KeyContext): Promise<Buffer>;
}

export class KeyUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyUnavailable";
  }
}

export const keyDir = (env: Env = process.env) => env.FERRY_KEY_DIR || path.join(process.cwd(), "data", "keys");

export function assertLocalKeysAllowed(env: Env, what: string): void {
  const tier = deployTier(env);
  if (tier !== "dev") throw new DeployConfigError(`${what} runs only in the dev tier, not ${tier}`);
}

// FERRY_LOCAL_KEK (base64, 32 bytes) wins; otherwise the file `bun run keys:dev` writes.
function localKek(env: Env): Buffer {
  const raw = env.FERRY_LOCAL_KEK || (fs.existsSync(path.join(keyDir(env), "kek")) ? fs.readFileSync(path.join(keyDir(env), "kek"), "utf8").trim() : "");
  if (!raw) throw new KeyUnavailable("No local key-encryption key. Run: bun run keys:dev");
  const kek = Buffer.from(raw, "base64");
  if (kek.length !== 32) throw new KeyUnavailable("The local key-encryption key must be 32 bytes, base64");
  return kek;
}

export function localKeyProvider(env: Env = process.env): KeyProvider {
  assertLocalKeysAllowed(env, "The local key provider");
  const bytes = localKek(env);
  const kek = { id: `local-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}`, bytes };
  return {
    async wrap(key, { tenantId }) {
      return { kekRef: kek.id, wrapped: sealBytes(kek, key, `tenant:${tenantId}`) };
    },
    async unwrap({ kekRef, wrapped }, { tenantId }) {
      if (kekRef !== kek.id) throw new KeyUnavailable("Wrapped under another local key-encryption key");
      return openBytes(kek, wrapped, `tenant:${tenantId}`);
    },
  };
}

// The slice of the AWS SDK v3 KMS client this uses (EncryptCommand, DecryptCommand). S21a adapts the real client.
export interface KmsApi {
  encrypt(input: { KeyId: string; Plaintext: Uint8Array; EncryptionContext: Record<string, string> }): Promise<{ CiphertextBlob?: Uint8Array; KeyId?: string }>;
  decrypt(input: { KeyId: string; CiphertextBlob: Uint8Array; EncryptionContext: Record<string, string> }): Promise<{ Plaintext?: Uint8Array; KeyId?: string }>;
}

export function awsKmsKeyProvider(kms: KmsApi, keyArn: string): KeyProvider {
  const context = (tenantId: string) => ({ purpose: "ferry-tenant-key", tenant: tenantId });
  return {
    async wrap(key, { tenantId }) {
      const out = await kms.encrypt({ KeyId: keyArn, Plaintext: key, EncryptionContext: context(tenantId) });
      if (!out.CiphertextBlob) throw new KeyUnavailable("KMS returned no ciphertext");
      return { kekRef: out.KeyId ?? keyArn, wrapped: Buffer.from(out.CiphertextBlob).toString("base64") };
    },
    async unwrap({ kekRef, wrapped }, { tenantId }) {
      const out = await kms.decrypt({ KeyId: kekRef, CiphertextBlob: Buffer.from(wrapped, "base64"), EncryptionContext: context(tenantId) });
      if (!out.Plaintext) throw new KeyUnavailable("KMS returned no plaintext");
      return Buffer.from(out.Plaintext);
    },
  };
}
