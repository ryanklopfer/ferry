import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });

const client = createClient({ url: `file:${path.join(dataDir, "app.db")}` });
export const db = drizzle(client, { schema });

const g = globalThis as unknown as { __migrated?: Promise<void> };
export function ready() {
  g.__migrated ??= migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return g.__migrated;
}

export { schema };
