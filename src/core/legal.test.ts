import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LegalFormatError, parseLegal } from "./legal";

const DIR = path.join(process.cwd(), "content", "legal");

describe("legal texts", () => {
  it("every file in content/legal has a title, a version and placeholder: true until the attorney's text lands", () => {
    const docs = fs.readdirSync(DIR).filter((f) => f.endsWith(".md"));
    expect(docs).toEqual(expect.arrayContaining(["privacy.md", "terms.md"]));
    for (const file of docs) {
      const doc = parseLegal(fs.readFileSync(path.join(DIR, file), "utf8"));
      expect(doc.title.length, file).toBeGreaterThan(3);
      expect(doc.version, file).toMatch(/^\d+\.\d+\.\d+$/);
      expect(doc.placeholder, file).toBe(true);
      expect(doc.blocks.length, file).toBeGreaterThan(0);
    }
  });

  it("reads headings and paragraphs, joining wrapped lines", () => {
    const doc = parseLegal("---\ntitle: Terms\nversion: 1.0.0\nplaceholder: false\n---\n\n## One\n\nFirst line\nsecond line.\n\nNext.\n");
    expect(doc).toEqual({
      title: "Terms",
      version: "1.0.0",
      placeholder: false,
      blocks: [
        { kind: "heading", text: "One" },
        { kind: "paragraph", text: "First line second line." },
        { kind: "paragraph", text: "Next." },
      ],
    });
  });

  it("refuses a text without front matter or a placeholder flag", () => {
    expect(() => parseLegal("Just text")).toThrow(LegalFormatError);
    expect(() => parseLegal("---\ntitle: Terms\nversion: 1.0.0\n---\nBody")).toThrow(LegalFormatError);
  });
});
