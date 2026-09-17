import { pool } from "./index";

export async function resetDb(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>("select current_database() as name");
  if (!rows[0].name.endsWith("_test")) throw new Error(`resetDb refused: "${rows[0].name}" is not a test database`);
  const tables = await pool.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public'");
  if (!tables.rows.length) return;
  const list = tables.rows.map((t) => `"${t.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
