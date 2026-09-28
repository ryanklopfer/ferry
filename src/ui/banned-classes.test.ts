import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GALLERY_SCREENS } from "@/app/dev/ui/screens";

const ROOT = process.cwd();
const SELF = path.relative(ROOT, __filename);

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? files(full) : [path.relative(ROOT, full)];
  });
}

const SOURCES = files(path.join(ROOT, "src"))
  .filter((f) => f !== SELF && /\.(tsx?|css|m?js|md|json)$/.test(f))
  .map((f) => ({ file: f, text: fs.readFileSync(path.join(ROOT, f), "utf8") }));

// FERRY_BRAND §3 and §11: no warm grey, no shadows, no dividers, no gradients, no ALL CAPS.
// Variant prefixes (hover:, md:) and arbitrary values count too.
const BANNED = /(?<![\w-])(?:[\w-]+:)*(?:(?:[a-z]+-)*stone-[\w./[\]-]+|shadow(?:-[\w./[\]-]+)?|divide-[\w./[\]-]+|bg-gradient-[\w./[\]-]+|uppercase)(?![\w-])/g;
const BANNED_CSS = /(?<![\w-])(?:box|text)-shadow\s*:|(?:linear|radial|conic)-gradient\(/g;

const hits = (re: RegExp, only?: RegExp) =>
  SOURCES.filter(({ file }) => !only || only.test(file)).flatMap(({ file, text }) => [...text.matchAll(re)].map((m) => `${file}: ${m[0]}`));

describe("banned classes", () => {
  it("no stone-, shadow-, divide-, bg-gradient or uppercase class anywhere in src/", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
    expect(hits(BANNED)).toEqual([]);
    expect(hits(BANNED_CSS, /\.css$/)).toEqual([]);
  });

  it("the checker catches each banned class, with or without a variant", () => {
    const sample = 'className="bg-stone-50 hover:text-stone-900 shadow shadow-lg md:shadow-xs divide-y bg-gradient-to-r uppercase"';
    expect([...sample.matchAll(BANNED)].map((m) => m[0])).toEqual(["bg-stone-50", "hover:text-stone-900", "shadow", "shadow-lg", "md:shadow-xs", "divide-y", "bg-gradient-to-r", "uppercase"]);
    expect([..."toUpperCase() box-shadow".matchAll(BANNED)]).toEqual([]);
    expect([..."a { box-shadow: 0 1px; background: linear-gradient(red, blue) } --text-shadow-*: initial;".matchAll(BANNED_CSS)].map((m) => m[0])).toEqual(["box-shadow:", "linear-gradient("]);
  });

  it("'Superbill Claims' appears nowhere in src/", () => {
    expect(hits(new RegExp(["Superbill", "Claims"].join(" "), "gi"))).toEqual([]);
  });
});

describe("the gallery", () => {
  const primaries = (html: string) => (html.match(/data-variant="primary"/g) ?? []).length;

  it("has screens for the phone and the desktop", () => {
    expect(GALLERY_SCREENS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(GALLERY_SCREENS.map((s) => s.frame))).toEqual(new Set(["phone", "desktop"]));
    expect(new Set(GALLERY_SCREENS.map((s) => s.id)).size).toBe(GALLERY_SCREENS.length);
  });

  it("no gallery screen has two primary buttons", () => {
    const counts = GALLERY_SCREENS.map((s) => [s.id, primaries(renderToStaticMarkup(createElement(s.Body)))] as const);
    expect(counts.filter(([, n]) => n > 1)).toEqual([]);
    expect(counts.some(([, n]) => n === 1)).toBe(true);
  });

  it("the counter sees two primary buttons", () => {
    const two = GALLERY_SCREENS.filter((s) => s.id === "buttons" || s.id === "clinician-note").map((s) => renderToStaticMarkup(createElement(s.Body)));
    expect(two).toHaveLength(2);
    expect(primaries(two.join(""))).toBe(2);
  });
});
