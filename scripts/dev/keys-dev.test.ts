import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { localKeyProvider } from "../../src/server/crypto/key-provider";
import { keysDev } from "./keys-dev";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ferry-keys-dev-"));
const DEV = { FERRY_DEPLOY_TIER: "dev", DATABASE_URL: "postgres://localhost:5432/ferry_dev", FERRY_KEY_DIR: dir };

describe("keys:dev", () => {
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("creates a 32-byte key-encryption key the local provider uses, readable only by its owner", async () => {
    const { kekPath, created } = keysDev(DEV);
    expect(created).toBe(true);
    expect(Buffer.from(fs.readFileSync(kekPath, "utf8").trim(), "base64")).toHaveLength(32);
    expect(fs.statSync(kekPath).mode & 0o077).toBe(0);
    expect(fs.statSync(path.join(dir, "ephemeral")).isDirectory()).toBe(true);
    const provider = localKeyProvider({ FERRY_DEPLOY_TIER: "dev", FERRY_KEY_DIR: dir });
    const key = Buffer.alloc(64, 3);
    expect(await provider.unwrap(await provider.wrap(key, { tenantId: "usr_x" }), { tenantId: "usr_x" })).toEqual(key);
  });

  it("never replaces an existing key", () => {
    const before = fs.readFileSync(path.join(dir, "kek"), "utf8");
    expect(keysDev(DEV).created).toBe(false);
    expect(fs.readFileSync(path.join(dir, "kek"), "utf8")).toBe(before);
  });

  it.each(["prelaunch", "staging", "prod"])("refuses in the %s tier", (tier) => {
    expect(() => keysDev({ ...DEV, FERRY_DEPLOY_TIER: tier, FERRY_KEY_DIR: path.join(dir, tier) })).toThrow(/dev tier/);
    expect(fs.existsSync(path.join(dir, tier))).toBe(false);
  });
});
