import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { keyDir } from "../../src/server/crypto/key-provider";
import { assertDevTier, DeployConfigError, type Env } from "../../src/server/deploy";

// bun run keys:dev. Creates the dev tier's local key-encryption key and ephemeral key directory under data/keys
// (gitignored). Never replaces an existing key: every tenant key in ferry_dev is wrapped by it.
export function keysDev(env: Env = process.env): { kekPath: string; created: boolean } {
  assertDevTier(env);
  const dir = keyDir(env);
  fs.mkdirSync(path.join(dir, "ephemeral"), { recursive: true, mode: 0o700 });
  const kekPath = path.join(dir, "kek");
  if (fs.existsSync(kekPath)) return { kekPath, created: false };
  fs.writeFileSync(kekPath, `${randomBytes(32).toString("base64")}\n`, { flag: "wx", mode: 0o600 });
  return { kekPath, created: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { kekPath, created } = keysDev();
    console.log(created ? `keys:dev: created ${kekPath}` : `keys:dev: kept the existing ${kekPath}`);
  } catch (e) {
    if (!(e instanceof DeployConfigError)) throw e;
    console.error(e.message);
    process.exitCode = 1;
  }
}
