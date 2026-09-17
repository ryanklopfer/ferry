import fs from "node:fs/promises";
import path from "node:path";

const root = () => path.resolve(process.env.FERRY_UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"));

function resolve(key: string): string {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putFile(key: string, bytes: Buffer): Promise<void> {
  const full = resolve(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, bytes);
}

export function getFile(key: string): Promise<Buffer> {
  return fs.readFile(resolve(key));
}

export async function deleteFile(key: string): Promise<void> {
  await fs.rm(resolve(key), { force: true });
}
