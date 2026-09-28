import fs from "node:fs/promises";
import path from "node:path";
import { type LegalDoc, parseLegal } from "@/core/legal";

const DIR = path.join(process.cwd(), "content", "legal");

// Only a lowercase slug reaches the file system, so a URL can't name a path outside content/legal.
export async function loadLegal(slug: string): Promise<LegalDoc | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return parseLegal(await fs.readFile(path.join(DIR, `${slug}.md`), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
