import fs from "node:fs/promises";
import path from "node:path";
import { type ConsentDocType, docHash, LEGAL_SLUG, type LegalDoc, parseLegal } from "@/core/legal";
import { deployTier, type Env } from "./deploy";

const REPO_DIR = path.join(process.cwd(), "content", "legal");

// FERRY_LEGAL_DIR lets tests and the e2e server bump a version in a copy of the texts. Outside the dev tier it is
// ignored, so no deployment can point assertLiveLegal or a consent hash at other texts.
export function legalDir(env: Env = process.env): string {
  try {
    if (env.FERRY_LEGAL_DIR && deployTier(env) === "dev") return env.FERRY_LEGAL_DIR;
  } catch {
    // An unreadable tier is not the dev tier.
  }
  return REPO_DIR;
}

async function read(slug: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(legalDir(), `${slug}.md`), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

// Only a lowercase slug reaches the file system, so a URL can't name a path outside the legal directory.
export async function loadLegal(slug: string): Promise<LegalDoc | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const source = await read(slug);
  return source === null ? null : parseLegal(source);
}

export type LiveText = { doc: LegalDoc; hash: string };

// Read on every call, never cached: a new version is live the moment its file is.
export async function liveText(docType: ConsentDocType): Promise<LiveText> {
  const source = await read(LEGAL_SLUG[docType]);
  if (source === null) throw new Error(`content/legal/${LEGAL_SLUG[docType]}.md is missing`);
  return { doc: parseLegal(source), hash: docHash(source) };
}

export class LegalPlaceholder extends Error {
  constructor(readonly docTypes: ConsentDocType[]) {
    super(`Still a placeholder: ${docTypes.join(", ")}`);
    this.name = "LegalPlaceholder";
  }
}

// Live submission, live recording, real letters and prod onboarding call this with the texts they rely on (F4).
export async function assertLiveLegal(docTypes: readonly ConsentDocType[]): Promise<void> {
  const texts = await Promise.all(docTypes.map(async (t) => [t, await liveText(t)] as const));
  const placeholders = texts.filter(([, live]) => live.doc.placeholder).map(([t]) => t);
  if (placeholders.length) throw new LegalPlaceholder(placeholders);
}
