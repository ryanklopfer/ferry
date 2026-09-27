import { randomBytes } from "node:crypto";
import { auth } from "@/server/auth";
import type { ClinicianCtx, Role, SelfCtx, StaffCtx } from "@/server/auth/ctx";
import { sentInThisProcess } from "@/server/integrations/email";
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

type TestUser = { pending: { userId: string }; clinician: ClinicianCtx; client: SelfCtx; staff: StaffCtx };

export async function createTestUser<R extends Role>(role: R, email = `${role}-${randomBytes(4).toString("hex")}@example.test`): Promise<TestUser[R]> {
  const id = `usr_test_${randomBytes(8).toString("hex")}`;
  await db.insert(users).values({ id, name: email.split("@")[0], email, emailVerified: true, role });
  const byRole: TestUser = { pending: { userId: id }, clinician: { scope: "clinician", userId: id }, client: { scope: "self", userId: id }, staff: { scope: "staff", userId: id } };
  return byRole[role];
}

// Signs in through the real magic-link flow (fixture email) and returns request headers carrying the session cookie.
export async function signedInHeaders(email: string): Promise<Headers> {
  sentInThisProcess.length = 0;
  await auth.api.signInMagicLink({ body: { email, callbackURL: "/" }, headers: new Headers() });
  const link = new URL(sentInThisProcess.at(-1)!.text.match(/https?:\/\/\S+/)![0]);
  const query = Object.fromEntries(link.searchParams) as { token: string; callbackURL?: string };
  const response = await auth.api.magicLinkVerify({ query, headers: new Headers(), asResponse: true });
  const cookie = response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return new Headers({ cookie });
}
