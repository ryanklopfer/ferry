import { pool } from "./index";

export async function resetDb(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>("select current_database() as name");
  if (!rows[0].name.endsWith("_test")) throw new Error(`resetDb refused: "${rows[0].name}" is not a test database`);
  await pool.query("TRUNCATE plans, claims, line_items, follow_ups, events RESTART IDENTITY CASCADE");
}
