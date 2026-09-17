import { migrateDb } from "../../src/server/db/migrate";

const test = process.argv.includes("--test");
const url = test ? (process.env.DATABASE_URL_TEST ?? "postgres://localhost:5432/ferry_test") : process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}
await migrateDb(url);
console.log(`migrated ${new URL(url).pathname.slice(1)}`);
