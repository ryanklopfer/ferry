import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Env } from "@/server/deploy";
import { keyIdOf, open, seal } from "./aead";
import { assertLocalKeysAllowed, keyDir, KeyUnavailable } from "./key-provider";

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
  listBackups(input: { TableName: string; BackupType: "ALL" }): Promise<{ BackupSummaries?: unknown[] }>;
  describeTable(input: { TableName: string }): Promise<{ Table?: { StreamSpecification?: { StreamEnabled?: boolean }; Replicas?: unknown[] } }>;
  describeKinesisStreamingDestination(input: { TableName: string }): Promise<{ KinesisDataStreamDestinations?: { DestinationStatus?: string }[] }>;
}

export const DYNAMO_TTL_ATTRIBUTE = "expires_at";

export class UnsafeKeyTable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeKeyTable";
  }
}

// Any copy of the table outlives destroy(): point-in-time recovery (35 days), on-demand or AWS Backup backups, a
// stream or Kinesis destination (the key is in the item image), or a global-table replica. All must be off. TTL is
// the backstop that removes keys the erasure sweeper missed. ListBackups sees AWS Backup recovery points once
// taken, not a plan that hasn't run yet: S21a/S21b keep this table out of every AWS Backup plan.
export async function assertKeyTableSafe(ddb: DynamoApi, table: string): Promise<void> {
  const TableName = table;
  const pitr = await ddb.describeContinuousBackups({ TableName });
  if (pitr.ContinuousBackupsDescription?.PointInTimeRecoveryDescription?.PointInTimeRecoveryStatus !== "DISABLED") throw new UnsafeKeyTable(`${table}: point-in-time recovery must be off`);
  const backups = await ddb.listBackups({ TableName, BackupType: "ALL" });
  if (backups.BackupSummaries?.length) throw new UnsafeKeyTable(`${table}: must have no backups`);
  const { Table } = await ddb.describeTable({ TableName });
  if (!Table) throw new UnsafeKeyTable(`${table}: not found`);
  if (Table.StreamSpecification?.StreamEnabled) throw new UnsafeKeyTable(`${table}: DynamoDB Streams must be off`);
  if (Table.Replicas?.length) throw new UnsafeKeyTable(`${table}: must have no global-table replicas`);
  const kinesis = await ddb.describeKinesisStreamingDestination({ TableName });
  if (kinesis.KinesisDataStreamDestinations?.some((d) => d.DestinationStatus !== "DISABLED")) throw new UnsafeKeyTable(`${table}: Kinesis streaming must be off`);
  const ttl = await ddb.describeTimeToLive({ TableName });
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

const expired = (key: EphemeralKey) => key.expiresAt.getTime() <= Date.now();

// The first seal makes the record's key. An edit (autosave, appended dictation, a corrected scan field) or a retry
// re-seals under the same key, so expires_at never moves. Refused once the record has expired.
export async function sealEphemeral(store: EphemeralKeyStore, recordId: string, plaintext: string, expiresAt: Date): Promise<string> {
  const found = await store.get(recordId);
  if (found && expired(found)) throw new KeyUnavailable("This record has expired");
  const key = found?.key ?? (await store.create(recordId, expiresAt)).key;
  return seal({ id: ephemeralKeyId(recordId), bytes: key }, plaintext);
}

// Null once the key is gone or expires_at has passed on the server clock, even if the erasure sweeper hasn't run yet.
// Reads go through here; the store's raw get is for the sweeper and test helpers (lint-restricted).
export async function openEphemeral(store: EphemeralKeyStore, recordId: string, value: string): Promise<string | null> {
  if (keyIdOf(value) !== ephemeralKeyId(recordId)) throw new Error("Sealed for another record");
  const found = await store.get(recordId);
  if (!found || expired(found)) return null;
  return open({ id: ephemeralKeyId(recordId), bytes: found.key }, value);
}
