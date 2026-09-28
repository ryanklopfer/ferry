import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLORS } from "@/core/brand";

const ROOT = process.cwd();
const THEME_FILE = "src/app/globals.css";
const SELF = path.relative(ROOT, __filename);
const brand = fs.readFileSync(path.join(ROOT, "FERRY_BRAND.md"), "utf8");
const css = fs.readFileSync(path.join(ROOT, THEME_FILE), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function section(heading: RegExp): string {
  const start = brand.search(heading);
  expect(start, String(heading)).toBeGreaterThan(-1);
  const rest = brand.slice(start);
  const next = rest.slice(1).search(/\n#{2,3} /);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

const fence = (text: string) => text.match(/```\w*\n([\s\S]*?)```/)![1];

const declared = new Map<string, string>();
for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) declared.set(name, value.trim());

function resolve(name: string): string | undefined {
  const value = declared.get(name);
  return value?.replace(/var\((--[\w-]+)\)/g, (whole, inner: string) => (declared.has(inner) ? resolve(inner)! : whole));
}

const norm = (v: string) => v.replace(/"/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const px = (v: string) => (v.endsWith("rem") ? parseFloat(v) * 16 : parseFloat(v));
const num = (v: string) => parseFloat(v.replace("−", "-"));
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// The first family comes from next/font (layout.tsx), whose variable carries that family's name.
function expectFontStack(token: string, brandStack: string) {
  const [family, ...fallbacks] = brandStack.split(",").map((s) => s.trim());
  const [first, ...rest] = resolve(token)!.split(",").map((s) => s.trim());
  expect(norm(rest.join(", ")), token).toBe(norm(fallbacks.join(", ")));
  const variable = first.match(/^var\((--font-[\w-]+)\)$/)?.[1];
  expect(variable, `${token} starts with a next/font variable`).toBeDefined();
  const layout = fs.readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");
  const fn = family.replace(/['"]/g, "").replace(/ /g, "_");
  expect(layout).toMatch(new RegExp(`${fn}\\(\\{[^}]*variable: "${variable}"`));
}

describe("FERRY_BRAND §3 colour, font and radius tokens", () => {
  it("every CSS variable exists under the same name and value", () => {
    const vars = [...fence(section(/^### CSS variables/m)).matchAll(/(--ferry-[\w-]+):\s*([^;]+);/g)];
    expect(vars.length).toBe(20);
    for (const [, name, value] of vars) {
      expect(declared.has(name), name).toBe(true);
      if (name.startsWith("--ferry-font-")) expectFontStack(name, value);
      else expect(norm(resolve(name)!), name).toBe(norm(value));
    }
  });

  it("every colour in the table is one of those variables", () => {
    const rows = [...section(/^## 3\. Color/m).matchAll(/^\| (\w+) \| (#[0-9A-F]{6}) \|/gm)];
    expect(rows.length).toBe(14);
    const byValue = new Map([...declared.keys()].filter((k) => k.startsWith("--ferry-")).map((k) => [norm(resolve(k)!), k]));
    for (const [, token, hex] of rows) expect(byValue.get(norm(hex)), token).toBeDefined();
  });

  it("every Tailwind name exists as a theme token with the same value", () => {
    const block = fence(section(/^### Tailwind/m));
    const colors = block.match(/colors: \{([\s\S]*?)\n\},/)![1];
    const expected = new Map<string, string>();
    for (const [, name, inner] of colors.matchAll(/(\w+): \{([^}]*)\}/g)) {
      for (const [, key, hex] of inner.matchAll(/(\w+): '(#[0-9A-F]{6})'/g)) expected.set(`--color-${key === "DEFAULT" ? name : `${name}-${key}`}`, hex);
    }
    for (const [, name, hex] of colors.replace(/\w+: \{[^}]*\}/g, "").matchAll(/(\w+): '(#[0-9A-F]{6})'/g)) expected.set(`--color-${name}`, hex);
    expect(expected.size).toBe(13);
    for (const [token, hex] of expected) expect(norm(resolve(token) ?? "missing"), token).toBe(norm(hex));

    for (const [, name, list] of block.matchAll(/(display|body): \[([^\]]+)\]/g)) expectFontStack(`--font-${name}`, list.replace(/'/g, ""));

    const radius = block.match(/borderRadius: \{([^}]*)\}/)![1];
    const radii = [...radius.matchAll(/'?([\w-]+)'?: '(\d+px)'/g)];
    expect(radii.length).toBe(3);
    for (const [, name, value] of radii) expect(resolve(`--radius-${name}`), name).toBe(value);
  });
});

describe("FERRY_BRAND §4 type styles", () => {
  it("every style exists as a text token with its size, line height, weight and tracking", () => {
    const rows = [...section(/^## 4\. Typography/m).matchAll(/^\| ([\w ()/]+?) \| (Display|Body) \| (\d+) \/ ([\d.]+) \| (\d+) \| ([−-]?[\d.]+(?:em)?) \|/gm)];
    expect(rows.length).toBe(11);
    for (const [, style, , size, line, weight, tracking] of rows) {
      const name = `--text-${style.split(" ")[0]}`;
      expect(px(resolve(name) ?? "NaN"), name).toBe(Number(size));
      expect(num(resolve(`${name}--line-height`) ?? "NaN"), `${name} line height`).toBe(Number(line));
      expect(resolve(`${name}--font-weight`), `${name} weight`).toBe(weight);
      expect(num(resolve(`${name}--letter-spacing`) ?? "NaN"), `${name} tracking`).toBe(num(tracking));
    }
  });
});

describe("FERRY_BRAND §5 layout sizes", () => {
  it("the spacing scale is Tailwind's 4 px step and every named size exists", () => {
    expect(px(resolve("--spacing")!)).toBe(4);
    const scale = section(/^## 5\. Layout/m).match(/Spacing scale: ([\d, ]+)\./)![1].split(", ").map(Number);
    expect(scale.every((n) => n % 4 === 0)).toBe(true);

    // §5's and §6's sizes, which the brand names only in prose.
    const sizes: Record<string, number> = {
      "--spacing-screen-top": 60,
      "--spacing-gutter": 20,
      "--spacing-screen-bottom": 24,
      "--spacing-section": 20,
      "--spacing-touch": 44,
      "--spacing-btn-primary": 60,
      "--spacing-btn-secondary": 56,
      "--spacing-btn-tertiary": 48,
      "--spacing-nav": 64,
      "--spacing-nav-item": 48,
    };
    const prose = section(/^## 5\. Layout/m) + section(/^## 6\. Components/m);
    for (const [token, value] of Object.entries(sizes)) {
      expect(prose, token).toContain(String(value));
      expect(px(resolve(token) ?? "NaN"), token).toBe(value);
    }
  });
});

describe("colours live only in the theme file", () => {
  const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;

  function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? files(full) : [path.relative(ROOT, full)];
    });
  }

  it("no hex colour appears anywhere else in src/", () => {
    const hits = files(path.join(ROOT, "src"))
      .filter((f) => f !== THEME_FILE && f !== SELF && f !== "src/core/brand.ts" && /\.(tsx?|css|m?js|json|svg)$/.test(f))
      .flatMap((f) => [...fs.readFileSync(path.join(ROOT, f), "utf8").matchAll(HEX)].map((m) => `${f}: ${m[0]}`));
    expect(hits).toEqual([]);
  });

  it("the manifest's literal colours in brand.ts are the theme's own values", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/core/brand.ts"), "utf8");
    const values = Object.values(COLORS) as string[];
    expect([...source.matchAll(HEX)].map((m) => m[0]).every((hex) => values.includes(hex))).toBe(true);
    for (const [name, hex] of Object.entries(COLORS)) expect(norm(resolve(`--ferry-${kebab(name)}`) ?? "missing"), name).toBe(norm(hex));
  });

  it("the checker finds a hex colour", () => {
    expect("text-[#F0704F] fill:#fff".match(HEX)).toEqual(["#F0704F", "#fff"]);
    expect("href=#i-mic #add-line".match(HEX)).toBeNull();
  });
});
