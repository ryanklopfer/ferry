import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertKeyTableSafe, type DynamoApi, dynamoEphemeralKeyStore, DYNAMO_TTL_ATTRIBUTE, type EphemeralKeyStore, localEphemeralKeyStore, openEphemeral, sealEphemeral, UnsafeKeyTable } from "./ephemeral";

const TABLE = "ferry-ephemeral-keys";
const HOUR = 3_600_000;
const NOW = new Date("2026-10-02T12:00:00Z");

class ConditionalCheckFailedException extends Error {
  name = "ConditionalCheckFailedException";
}

type Item = Parameters<DynamoApi["putItem"]>[0]["Item"];

// Behaves like DynamoDB for the calls the store makes. TTL deletion is lazy in AWS, so the mock never deletes.
type TableSettings = { pitr?: string; ttlStatus?: string; ttlAttribute?: string; backups?: number; stream?: boolean; replicas?: number; kinesis?: string };
function mockDynamo(settings: TableSettings = {}) {
  const items = new Map<string, Item>();
  const calls: { op: string; input: unknown }[] = [];
  const ddb: DynamoApi = {
    async putItem(input) {
      calls.push({ op: "putItem", input });
      const id = input.Item.record_id.S!;
      if (input.ConditionExpression === "attribute_not_exists(record_id)" && items.has(id)) throw new ConditionalCheckFailedException();
      items.set(id, input.Item);
      return {};
    },
    async getItem(input) {
      calls.push({ op: "getItem", input });
      return { Item: items.get(input.Key.record_id.S!) };
    },
    async deleteItem(input) {
      calls.push({ op: "deleteItem", input });
      items.delete(input.Key.record_id.S!);
      return {};
    },
    async describeContinuousBackups() {
      return { ContinuousBackupsDescription: { PointInTimeRecoveryDescription: { PointInTimeRecoveryStatus: settings.pitr ?? "DISABLED" } } };
    },
    async describeTimeToLive() {
      return { TimeToLiveDescription: { TimeToLiveStatus: settings.ttlStatus ?? "ENABLED", AttributeName: settings.ttlAttribute ?? DYNAMO_TTL_ATTRIBUTE } };
    },
    async listBackups(input) {
      calls.push({ op: "listBackups", input });
      return { BackupSummaries: Array.from({ length: settings.backups ?? 0 }, (_, i) => ({ BackupName: `b${i}`, BackupType: "AWS_BACKUP" })) };
    },
    async describeTable() {
      return { Table: { StreamSpecification: settings.stream ? { StreamEnabled: true } : undefined, Replicas: Array.from({ length: settings.replicas ?? 0 }, () => ({ RegionName: "us-west-2" })) } };
    },
    async describeKinesisStreamingDestination() {
      return { KinesisDataStreamDestinations: settings.kinesis ? [{ DestinationStatus: settings.kinesis }] : [] };
    },
  };
  return { ddb, items, calls };
}

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
const tmpKeyDir = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ferry-eph-"));
  dirs.push(d);
  return d;
};

// openEphemeral and sealEphemeral read the server clock, so the tests move it.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

// Every EphemeralKeyStore keeps these promises; the dynamodb one is held to them against the mock.
function storeContract(name: string, make: () => EphemeralKeyStore) {
  describe(`${name} EphemeralKeyStore contract`, () => {
    it("creates a 32-byte key per record and gets it back with its expiry", async () => {
      const store = make();
      const expiresAt = new Date(NOW.getTime() + 24 * HOUR);
      const a = await store.create("trn_A", expiresAt);
      const b = await store.create("trn_B", expiresAt);
      expect(a.key).toHaveLength(32);
      expect(Buffer.compare(a.key, b.key)).not.toBe(0);
      const got = await store.get("trn_A");
      expect(got && Buffer.compare(got.key, a.key)).toBe(0);
      expect(got?.expiresAt.toISOString()).toBe(expiresAt.toISOString());
    });

    it("never replaces a record's key", async () => {
      const store = make();
      await store.create("trn_A", NOW);
      await expect(store.create("trn_A", NOW)).rejects.toThrow();
    });

    it("forgets a destroyed key, and destroying twice is fine", async () => {
      const store = make();
      await store.create("trn_A", NOW);
      await store.destroy("trn_A");
      await store.destroy("trn_A");
      expect(await store.get("trn_A")).toBeNull();
      expect(await store.get("trn_never")).toBeNull();
    });

    it("refuses a record id that could escape its namespace", async () => {
      const store = make();
      await expect(store.create("../kek", NOW)).rejects.toThrow();
      await expect(store.get("a/b")).rejects.toThrow();
    });

    it("seals a record openable until expiry or destruction, whichever is first", async () => {
      const store = make();
      const sealed = await sealEphemeral(store, "trn_A", "Client reports sleeping better", new Date(NOW.getTime() + 24 * HOUR));
      expect(await openEphemeral(store, "trn_A", sealed)).toBe("Client reports sleeping better");
      vi.setSystemTime(NOW.getTime() + 24 * HOUR);
      expect(await openEphemeral(store, "trn_A", sealed)).toBeNull();
      vi.setSystemTime(NOW);
      await store.destroy("trn_A");
      expect(await openEphemeral(store, "trn_A", sealed)).toBeNull();
    });

    it("re-seals an edited record under the same key without moving expires_at", async () => {
      const store = make();
      const expiresAt = new Date(NOW.getTime() + 24 * HOUR);
      const first = await sealEphemeral(store, "trn_A", "Client reports", expiresAt);
      vi.setSystemTime(NOW.getTime() + 2 * HOUR);
      const edited = await sealEphemeral(store, "trn_A", "Client reports sleeping better", new Date(Date.now() + 24 * HOUR));
      expect((await store.get("trn_A"))?.expiresAt.toISOString()).toBe(expiresAt.toISOString());
      expect(await openEphemeral(store, "trn_A", first)).toBe("Client reports");
      expect(await openEphemeral(store, "trn_A", edited)).toBe("Client reports sleeping better");
      vi.setSystemTime(expiresAt);
      await expect(sealEphemeral(store, "trn_A", "too late", new Date(Date.now() + HOUR))).rejects.toThrow(/expired/);
    });
  });
}

storeContract("local", () => localEphemeralKeyStore({ FERRY_DEPLOY_TIER: "dev", FERRY_KEY_DIR: tmpKeyDir() }));
storeContract("dynamodb (mocked client)", () => dynamoEphemeralKeyStore(mockDynamo().ddb, TABLE));

describe("dynamodb EphemeralKeyStore", () => {
  it("writes a TTL in epoch seconds, conditionally, and reads consistently", async () => {
    const { ddb, items, calls } = mockDynamo();
    const store = dynamoEphemeralKeyStore(ddb, TABLE);
    const expiresAt = new Date(NOW.getTime() + 24 * HOUR + 500);
    await store.create("trn_A", expiresAt);
    await store.get("trn_A");
    expect(items.get("trn_A")?.[DYNAMO_TTL_ATTRIBUTE]).toEqual({ N: String(Math.ceil(expiresAt.getTime() / 1000)) });
    expect(calls.map((c) => c.op)).toEqual(["putItem", "getItem"]);
    expect(calls[0].input).toMatchObject({ TableName: TABLE, ConditionExpression: "attribute_not_exists(record_id)" });
    expect(calls[1].input).toMatchObject({ TableName: TABLE, ConsistentRead: true });
  });

  it("treats an expired item DynamoDB hasn't swept yet as gone for reading", async () => {
    const store = dynamoEphemeralKeyStore(mockDynamo().ddb, TABLE);
    const sealed = await sealEphemeral(store, "trn_A", "rough note", new Date(NOW.getTime() - 1));
    expect(await store.get("trn_A")).not.toBeNull();
    expect(await openEphemeral(store, "trn_A", sealed)).toBeNull();
  });

  it("accepts a table with point-in-time recovery, backups, streams and replicas off and TTL on", async () => {
    const { ddb, calls } = mockDynamo({ kinesis: "DISABLED" });
    await expect(assertKeyTableSafe(ddb, TABLE)).resolves.toBeUndefined();
    expect(calls.find((c) => c.op === "listBackups")?.input).toEqual({ TableName: TABLE, BackupType: "ALL" });
  });

  it("refuses a table with any copy that would outlive a destroyed key", async () => {
    await expect(assertKeyTableSafe(mockDynamo({ backups: 1 }).ddb, TABLE)).rejects.toThrow(/no backups/);
    await expect(assertKeyTableSafe(mockDynamo({ stream: true }).ddb, TABLE)).rejects.toThrow(/Streams/);
    await expect(assertKeyTableSafe(mockDynamo({ replicas: 1 }).ddb, TABLE)).rejects.toThrow(/replicas/);
    await expect(assertKeyTableSafe(mockDynamo({ kinesis: "ACTIVE" }).ddb, TABLE)).rejects.toThrow(/Kinesis/);
    await expect(assertKeyTableSafe(mockDynamo({ kinesis: "ENABLING" }).ddb, TABLE)).rejects.toThrow(UnsafeKeyTable);
  });

  it("refuses a table with point-in-time recovery on, or without TTL on expires_at", async () => {
    await expect(assertKeyTableSafe(mockDynamo({ pitr: "ENABLED" }).ddb, TABLE)).rejects.toThrow(UnsafeKeyTable);
    await expect(assertKeyTableSafe(mockDynamo({ ttlStatus: "DISABLED" }).ddb, TABLE)).rejects.toThrow(/TTL/);
    await expect(assertKeyTableSafe(mockDynamo({ ttlAttribute: "ttl" }).ddb, TABLE)).rejects.toThrow(/TTL/);
  });
});
