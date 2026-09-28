import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ageOn, CONSENT_DOC_TYPES, type ConsentRecord, currentConsent, docHash, earliestUsDate, LEGAL_SLUG, LegalFormatError, parseLegal } from "./legal";
import { sha256Hex } from "./sha256";

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

describe("docHash", () => {
  it("is the sha256 of the text, matching node:crypto for any input", () => {
    for (const text of ["", "abc", "é ✓ 漢字", "x".repeat(55), "x".repeat(56), "x".repeat(64), randomBytes(300).toString("base64")]) {
      expect(sha256Hex(text), text.slice(0, 10)).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
    }
  });

  it("changes with the version line and ignores line-ending style", () => {
    const a = "---\ntitle: Terms\nversion: 1.0.0\nplaceholder: false\n---\nBody\n";
    expect(docHash(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(docHash(a.replace("1.0.0", "1.0.1"))).not.toBe(docHash(a));
    expect(docHash(a.replace(/\n/g, "\r\n"))).toBe(docHash(a));
  });

  it("every consent doc type has a text in content/legal", () => {
    for (const t of CONSENT_DOC_TYPES) expect(fs.existsSync(path.join(DIR, `${LEGAL_SLUG[t]}.md`)), t).toBe(true);
  });
});

describe("currentConsent", () => {
  const rec = (over: Partial<ConsentRecord>): ConsentRecord => ({ docType: "client_filing", contentHash: "h1", createdAt: new Date("2026-10-01T00:00:00Z"), withdrawnAt: null, ...over });

  it("is none without a record of that type, current on the live hash, stale on another", () => {
    expect(currentConsent([], "client_filing", "h1")).toBe("none");
    expect(currentConsent([rec({ docType: "client_recording" })], "client_filing", "h1")).toBe("none");
    expect(currentConsent([rec({})], "client_filing", "h1")).toBe("current");
    expect(currentConsent([rec({})], "client_filing", "h2")).toBe("stale");
  });

  it("goes by the latest record that isn't withdrawn", () => {
    const old = rec({ contentHash: "h1", createdAt: new Date("2026-10-01T00:00:00Z") });
    const renewed = rec({ contentHash: "h2", createdAt: new Date("2026-10-05T00:00:00Z") });
    expect(currentConsent([renewed, old], "client_filing", "h2")).toBe("current");
    expect(currentConsent([old, { ...renewed, withdrawnAt: new Date() }], "client_filing", "h2")).toBe("stale");
    expect(currentConsent([{ ...old, withdrawnAt: new Date() }], "client_filing", "h1")).toBe("none");
  });
});

describe("ageOn", () => {
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

  it("counts whole years, turning over on the birthday", () => {
    expect(ageOn("2008-10-02", day("2026-10-01"))).toBe(17);
    expect(ageOn("2008-10-02", day("2026-10-02"))).toBe(18);
    expect(ageOn("1990-01-01", day("2026-10-01"))).toBe(36);
  });

  it("is null for anything that isn't a real ISO date", () => {
    for (const bad of ["", "10/02/2008", "2008-02-30", "2008-13-01"]) expect(ageOn(bad, day("2026-10-01")), bad).toBeNull();
  });

  it("waits for the birthday to arrive in every US zone", () => {
    // 8 pm in New York on Sep 27 is already Sep 28 in UTC.
    expect(ageOn("2008-09-28", earliestUsDate(new Date("2026-09-28T00:00:00Z")))).toBe(17);
    expect(ageOn("2008-09-28", earliestUsDate(new Date("2026-09-28T10:59:59Z")))).toBe(17);
    expect(ageOn("2008-09-28", earliestUsDate(new Date("2026-09-28T11:00:00Z")))).toBe(18);
  });
});
