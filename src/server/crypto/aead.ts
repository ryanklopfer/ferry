import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM field encryption. Stored as v1.<keyId>.<iv>.<ciphertext>.<tag>, base64url parts.
export type DataKey = { id: string; bytes: Buffer };

export class SealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SealError";
  }
}

const VERSION = "v1";
const KEY_ID = /^[A-Za-z0-9_-]{1,80}$/;
const b64 = (b: Buffer) => b.toString("base64url");

// The version and key id are authenticated, so a value can't be relabelled to another key.
const aadFor = (keyId: string, context: string) => Buffer.from(`${VERSION}.${keyId}|${context}`);

function assertKey(key: DataKey) {
  if (!KEY_ID.test(key.id)) throw new SealError("A key id is letters, digits, - and _ only");
  if (key.bytes.length !== 32) throw new SealError("A data key is 32 bytes");
}

export function sealBytes(key: DataKey, plaintext: Buffer, context = ""): string {
  assertKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key.bytes, iv);
  cipher.setAAD(aadFor(key.id, context));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [VERSION, key.id, b64(iv), b64(ct), b64(cipher.getAuthTag())].join(".");
}

export function openBytes(key: DataKey, value: string, context = ""): Buffer {
  assertKey(key);
  const parts = value.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) throw new SealError("Not a sealed value");
  const [, keyId, iv, ct, tag] = parts;
  if (keyId !== key.id) throw new SealError("Sealed under another key");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key.bytes, Buffer.from(iv, "base64url"));
    decipher.setAAD(aadFor(keyId, context));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]);
  } catch {
    throw new SealError("Sealed value failed authentication");
  }
}

export const seal = (key: DataKey, plaintext: string, context = "") => sealBytes(key, Buffer.from(plaintext, "utf8"), context);
export const open = (key: DataKey, value: string, context = "") => openBytes(key, value, context).toString("utf8");

export const isSealed = (value: unknown): value is string => typeof value === "string" && value.startsWith(`${VERSION}.`) && value.split(".").length === 5;

export function keyIdOf(value: string): string {
  if (!isSealed(value)) throw new SealError("Not a sealed value");
  return value.split(".")[1];
}
