import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseUrl } from "./env";
import * as schema from "./schema";

// Next's dev server re-evaluates modules on every edit; without this each reload would open a new pool.
const g = globalThis as unknown as { __ferryPool?: Pool };
export const pool = (g.__ferryPool ??= new Pool({ connectionString: databaseUrl() }));
export const db = drizzle({ client: pool, schema });

export { schema };
