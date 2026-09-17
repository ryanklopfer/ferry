import { migrateDb } from "./src/server/db/migrate";

export default async function setup() {
  const url = process.env.DATABASE_URL_TEST ?? "postgres://localhost:5432/ferry_test";
  try {
    await migrateDb(url);
  } catch (e) {
    throw new Error(
      `Could not migrate the test database at ${url}. Is Postgres running? ` +
        `Start it with: brew services start postgresql@17, then create it with: ` +
        `/opt/homebrew/opt/postgresql@17/bin/createdb ferry_test\n${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
