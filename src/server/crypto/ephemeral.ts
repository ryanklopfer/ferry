import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Env } from "@/server/deploy";
import { keyIdOf, open, seal } from "./aead";
import { assertLocalKeysAllowed, keyDir } from "./key-provider";

// One key per transcript, dictation, rough note or unconfirmed scan, held outside Postgres so a database backup
// holds only ciphertext. Destroying the key erases every copy of the record, restored backups included.
export type EphemeralKey = { recordId: string; key: Buffer; expiresAt: Date };
export interface EphemeralKeyStore {
  create(recordId: string, expiresAt: Date): Promise<EphemeralKey>;
  get(recordId: string): Promise<EphemeralKey | null>;
  destroy(recordId: string): Promise<void>;
}

const RECORD_ID = /^[A-Za-z0-9_-]{1,78}$/;
function assertRecordId(recordId: string) {
  if (!RECORD_ID.test(recordId)) throw new Error("A record id is letters, digits, - and _ only");
}

export const ephemeralKeyId = (recordId: string) => `e-${recordId}`;

// Dev only: one file per record under data/keys/ephemeral (gitignored), never inside the database.
export function localEphemeralKeyStore(env: Env = process.env): EphemeralKeyStore {
  assertLocalKeysAllowed(env, "The local ephemeral key store");
  const dir = path.join(keyDir(env), "ephemeral");
  const file = (recordId: string) => {
    assertRecordId(recordId);
    return path.join(dir, `${recordId}.json`);
  };
  return {
    async create(recordId, expiresAt) {
      const key = randomBytes(32);
      await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
      await fs.promises.writeFile(file(recordId), JSON.stringify({ key: key.toString("base64"), expiresAt: expiresAt.toISOString() }), { flag: "wx", mode: 0o600 });
      return { recordId, key, expiresAt };
    },
    async get(recordId) {
      try {
        const { key, expiresAt } = JSON.parse(await fs.promises.readFile(file(recordId), "utf8")) as { key: string; expiresAt: string };
        return { recordId, key: Buffer.from(key, "base64"), expiresAt: new Date(expiresAt) };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async destroy(recordId) {
      const f = file(recordId);
      try {
        const { size } = await fs.promises.stat(f);
        await fs.promises.writeFile(f, Buffer.alloc(size));
        await fs.promises.unlink(f);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    },
  };
}

// The slice of the AWS SDK v3 DynamoDB client this uses. S21a adapts the real client; S21a/S21b provision the table.
type Attr = { S?: string; N?: string; B?: Uint8Array };
export interface DynamoApi {
  putItem(input: { TableName: string; Item: Record<string, Attr>; ConditionExpression?: string }): Promise<unknown>;
  getItem(input: { TableName: string; Key: Record<string, Attr>; ConsistentRead?: boolean }): Promise<{ Item?: Record<string, Attr> }>;
  deleteItem(input: { TableName: string; Key: Record<string, Attr> }): Promise<unknown>;
  describeContinuousBackups(input: { TableName: string }): Promise<{ ContinuousBackupsDescription?: { PointInTimeRecoveryDescription?: { PointInTimeRecoveryStatus?: string } } }>;
  describeTimeToLive(input: { TableName: string }): Promise<{ TimeToLiveDescription?: { TimeToLiveStatus?: string; AttributeName?: string } }>;
}

export const DYNAMO_TTL_ATTRIBUTE = "expires_at";

export class UnsafeKeyTable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeKeyTable";
  }
}

// Point-in-time recovery would keep destroyed keys restorable for 35 days; TTL is the backstop that removes
// keys the erasure sweeper missed.
export async function assertKeyTableSafe(ddb: DynamoApi, table: string): Promise<void> {
  const backups = await ddb.describeContinuousBackups({ TableName: table });
  if (backups.ContinuousBackupsDescription?.PointInTimeRecoveryDescription?.PointInTimeRecoveryStatus !== "DISABLED") throw new UnsafeKeyTable(`${table}: point-in-time recovery must be off`);
  const ttl = await ddb.describeTimeToLive({ TableName: table });
  if (ttl.TimeToLiveDescription?.TimeToLiveStatus !== "ENABLED" || ttl.TimeToLiveDescription.AttributeName !== DYNAMO_TTL_ATTRIBUTE) throw new UnsafeKeyTable(`${table}: TTL must be on for ${DYNAMO_TTL_ATTRIBUTE}`);
}

export function dynamoEphemeralKeyStore(ddb: DynamoApi, table: string): EphemeralKeyStore {
  const keyOf = (recordId: string) => {
    assertRecordId(recordId);
    return { record_id: { S: recordId } };
  };
  return {
    async create(recordId, expiresAt) {
      const key = randomBytes(32);
      await ddb.putItem({
        TableName: table,
        Item: { ...keyOf(recordId), key: { B: key }, [DYNAMO_TTL_ATTRIBUTE]: { N: String(Math.ceil(expiresAt.getTime() / 1000)) }, expires_at_ms: { N: String(expiresAt.getTime()) } },
        ConditionExpression: "attribute_not_exists(record_id)",
      });
      return { recordId, key, expiresAt };
    },
    async get(recordId) {
      const { Item } = await ddb.getItem({ TableName: table, Key: keyOf(recordId), ConsistentRead: true });
      if (!Item?.key?.B || !Item.expires_at_ms?.N) return null;
      return { recordId, key: Buffer.from(Item.key.B), expiresAt: new Date(Number(Item.expires_at_ms.N)) };
    },
    async destroy(recordId) {
      await ddb.deleteItem({ TableName: table, Key: keyOf(recordId) });
    },
  };
}

export async function sealEphemeral(store: EphemeralKeyStore, recordId: string, plaintext: string, expiresAt: Date): Promise<string> {
  const { key } = await store.create(recordId, expiresAt);
  return seal({ id: ephemeralKeyId(recordId), bytes: key }, plaintext);
}

// Null once the key is gone or expires_at has passed, even if the erasure sweeper hasn't run yet.
export async function openEphemeral(store: EphemeralKeyStore, recordId: string, value: string, now: Date): Promise<string | null> {
  if (keyIdOf(value) !== ephemeralKeyId(recordId)) throw new Error("Sealed for another record");
  const found = await store.get(recordId);
  if (!found || found.expiresAt.getTime() <= now.getTime()) return null;
  return open({ id: ephemeralKeyId(recordId), bytes: found.key }, value);
}
