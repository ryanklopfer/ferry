import { Client } from "pg";
import { migrateDb } from "../../src/server/db/migrate";
import { assertDevTier } from "../../src/server/deploy";
import { E2E_DATABASE_URL } from "../../e2e/env";

assertDevTier({ ...process.env, DATABASE_URL: E2E_DATABASE_URL });
const name = decodeURIComponent(new URL(E2E_DATABASE_URL).pathname.slice(1));
if (!/^[a-z0-9_]+_test$/.test(name)) throw new Error("The e2e database name must end in _test");

const admin = new URL(E2E_DATABASE_URL);
admin.pathname = "/postgres";
const client = new Client({ connectionString: admin.toString() });
await client.connect();
const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [name]);
if (!rowCount) await client.query(`create database "${name}"`);
await client.end();
await migrateDb(E2E_DATABASE_URL);
console.log(`${rowCount ? "migrated" : "created and migrated"} ${name}`);
