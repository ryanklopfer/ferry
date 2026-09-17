import { randomBytes } from "node:crypto";
import type { Ctx } from "@/server/auth/ctx";
import { db, pool } from "./index";
import { users } from "./schema";

export async function resetDb(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>("select current_database() as name");
  if (!rows[0].name.endsWith("_test")) throw new Error(`resetDb refused: "${rows[0].name}" is not a test database`);
  const tables = await pool.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public'");
  if (!tables.rows.length) return;
  const list = tables.rows.map((t) => `"${t.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export async function createTestUser(email: string): Promise<Ctx> {
  const id = `usr_test_${randomBytes(8).toString("hex")}`;
  await db.insert(users).values({ id, name: email.split("@")[0], email, emailVerified: true, role: "patient" });
  return { userId: id, role: "patient" };
}
