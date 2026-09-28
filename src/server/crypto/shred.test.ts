import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { pool } from "@/server/db";
import { SealError, open } from "./aead";
import { ephemeralKeyId, openEphemeral, sealEphemeral } from "./ephemeral";
import { ephemeralKeyStore } from "./index";

// A stand-in for N8's transcripts table, in a schema of its own so it never reaches columns.ts or rawDump.
const TABLE = "test_only.transcripts_probe";
const HOUR = 3_600_000;
const TEXT = "Client describes panic attacks on the train to work";

type ProbeRow = { id: string; body: string; expires_at: Date };
const recordId = () => `trn_${randomBytes(8).toString("hex")}`;

describe("crypto-shredding an ephemeral record", () => {
  beforeAll(async () => {
    await pool.query("create schema if not exists test_only");
    await pool.query(`create table if not exists ${TABLE} (id text primary key, body text, expires_at timestamptz not null)`);
  });
  afterAll(async () => {
    await pool.query("drop schema if exists test_only cascade");
    await pool.end();
  });
  afterEach(() => vi.useRealTimers());

  it("leaves a restored backup copy undecryptable once the key is destroyed", async () => {
    const store = ephemeralKeyStore();
    const id = recordId();
    const expiresAt = new Date(Date.now() + 24 * HOUR);
    await pool.query(`insert into ${TABLE} values ($1, $2, $3)`, [id, await sealEphemeral(store, id, TEXT, expiresAt), expiresAt]);

    const backup = (await pool.query<ProbeRow>(`select * from ${TABLE} where id = $1`, [id])).rows[0];
    expect(backup.body).not.toContain("panic");
    expect(await openEphemeral(store, id, backup.body)).toBe(TEXT);
    const keyBefore = (await store.get(id))!.key;

    // Erasure: key first, then the ciphertext.
    await store.destroy(id);
    await pool.query(`update ${TABLE} set body = null where id = $1`, [id]);
    await pool.query(`delete from ${TABLE} where id = $1`, [id]);

    // Restore the backup copy as if from an RDS snapshot.
    await pool.query(`insert into ${TABLE} values ($1, $2, $3)`, [backup.id, backup.body, backup.expires_at]);
    const restored = (await pool.query<ProbeRow>(`select * from ${TABLE} where id = $1`, [id])).rows[0];
    expect(restored.body).toBe(backup.body);
    expect(await store.get(id)).toBeNull();
    expect(await openEphemeral(store, id, restored.body)).toBeNull();
    // Only the destroyed key opens it; any other key fails authentication.
    expect(() => open({ id: ephemeralKeyId(id), bytes: randomBytes(32) }, restored.body)).toThrow(SealError);
    expect(open({ id: ephemeralKeyId(id), bytes: keyBefore }, restored.body)).toBe(TEXT);
  });

  it("returns nothing after expires_at, before the key is destroyed", async () => {
    const store = ephemeralKeyStore();
    const id = recordId();
    const created = new Date();
    const expiresAt = new Date(created.getTime() + 24 * HOUR);
    await pool.query(`insert into ${TABLE} values ($1, $2, $3)`, [id, await sealEphemeral(store, id, TEXT, expiresAt), expiresAt]);
    const { body } = (await pool.query<ProbeRow>(`select * from ${TABLE} where id = $1`, [id])).rows[0];

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(expiresAt.getTime() - 1);
    expect(await openEphemeral(store, id, body)).toBe(TEXT);
    vi.setSystemTime(expiresAt);
    expect(await openEphemeral(store, id, body)).toBeNull();
    vi.setSystemTime(expiresAt.getTime() + HOUR);
    expect(await openEphemeral(store, id, body)).toBeNull();
    expect(await store.get(id)).not.toBeNull();
    await store.destroy(id);
  });

  it("refuses a value sealed for a different record", async () => {
    const store = ephemeralKeyStore();
    const [a, b] = [recordId(), recordId()];
    const expiresAt = new Date(Date.now() + HOUR);
    const sealedA = await sealEphemeral(store, a, TEXT, expiresAt);
    await store.create(b, expiresAt);
    await expect(openEphemeral(store, b, sealedA)).rejects.toThrow(/another record/);
    await store.destroy(a);
    await store.destroy(b);
  });
});
