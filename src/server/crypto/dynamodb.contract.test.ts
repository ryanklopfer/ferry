import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { assertKeyTableSafe, type DynamoApi, dynamoEphemeralKeyStore, DYNAMO_TTL_ATTRIBUTE, type EphemeralKeyStore, localEphemeralKeyStore, openEphemeral, sealEphemeral, UnsafeKeyTable } from "./ephemeral";

const TABLE = "ferry-ephemeral-keys";
const HOUR = 3_600_000;
const NOW = new Date("2026-10-02T12:00:00Z");

class ConditionalCheckFailedException extends Error {
  name = "ConditionalCheckFailedException";
}

type Item = Parameters<DynamoApi["putItem"]>[0]["Item"];

// Behaves like DynamoDB for the calls the store makes. TTL deletion is lazy in AWS, so the mock never deletes.
function mockDynamo(settings: { pitr?: string; ttlStatus?: string; ttlAttribute?: string } = {}) {
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
      expect(await openEphemeral(store, "trn_A", sealed, NOW)).toBe("Client reports sleeping better");
      expect(await openEphemeral(store, "trn_A", sealed, new Date(NOW.getTime() + 24 * HOUR))).toBeNull();
      await store.destroy("trn_A");
      expect(await openEphemeral(store, "trn_A", sealed, NOW)).toBeNull();
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
    expect(await openEphemeral(store, "trn_A", sealed, NOW)).toBeNull();
  });

  it("accepts a table with point-in-time recovery off and TTL on", async () => {
    await expect(assertKeyTableSafe(mockDynamo().ddb, TABLE)).resolves.toBeUndefined();
  });

  it("refuses a table with point-in-time recovery on, or without TTL on expires_at", async () => {
    await expect(assertKeyTableSafe(mockDynamo({ pitr: "ENABLED" }).ddb, TABLE)).rejects.toThrow(UnsafeKeyTable);
    await expect(assertKeyTableSafe(mockDynamo({ ttlStatus: "DISABLED" }).ddb, TABLE)).rejects.toThrow(/TTL/);
    await expect(assertKeyTableSafe(mockDynamo({ ttlAttribute: "ttl" }).ddb, TABLE)).rejects.toThrow(/TTL/);
  });
});
