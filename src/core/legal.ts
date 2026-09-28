// content/legal/<doc>.md: front matter, then paragraphs and "## " headings. Today `placeholder` only shows the
// Draft caption; S3b will version and hash these texts, and its assertLiveLegal will refuse live use while it is true.
export type LegalBlock = { kind: "heading" | "paragraph"; text: string };
export type LegalDoc = { title: string; version: string; placeholder: boolean; blocks: LegalBlock[] };

export class LegalFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalFormatError";
  }
}

export function parseLegal(source: string): LegalDoc {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new LegalFormatError("A legal text starts with front matter between --- lines");
  const meta = Object.fromEntries(match[1].split("\n").map((line) => {
    const at = line.indexOf(":");
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  }));
  if (!meta.title || !meta.version || !["true", "false"].includes(meta.placeholder)) throw new LegalFormatError("Front matter needs title, version and placeholder: true|false");
  const blocks = match[2]
    .split(/\n{2,}/)
    .map((b) => b.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean)
    .map((b): LegalBlock => (b.startsWith("## ") ? { kind: "heading", text: b.slice(3) } : { kind: "paragraph", text: b }));
  return { title: meta.title, version: meta.version, placeholder: meta.placeholder === "true", blocks };
}
