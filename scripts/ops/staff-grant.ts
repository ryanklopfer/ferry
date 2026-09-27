import path from "node:path";
import { fileURLToPath } from "node:url";
import { grantStaff, RoleRefused } from "../../src/server/services/roles";
import { pool } from "../../src/server/db";

// bun run staff:grant <email>
export async function staffGrant(args: string[]): Promise<number> {
  if (args.length !== 1) {
    console.error("Usage: bun run staff:grant <email>");
    return 1;
  }
  try {
    const { userId } = await grantStaff(args[0]);
    console.log(`staff granted to ${userId}`);
    return 0;
  } catch (e) {
    if (!(e instanceof RoleRefused)) throw e;
    console.error(e.message);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await staffGrant(process.argv.slice(2));
  await pool.end();
}
