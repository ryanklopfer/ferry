import fs from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Chip, CHIPS, type ChipKind } from "./chip";

const brand = fs.readFileSync(path.join(process.cwd(), "FERRY_BRAND.md"), "utf8");
const table = brand.slice(brand.indexOf("### 12.2 Chips"), brand.indexOf("### 12.3"));
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// | One quick thing | blush / navy, 16px outline hand icon | when |
const ROWS = [...table.matchAll(/^\| ([^|]+?) \| ([a-z]\w*) \/ ([a-z]\w*)(, [^|]+)? \| [^|]+\|$/gm)].map(([, label, fill, text, extra]) => ({
  label,
  fill: kebab(fill),
  text: kebab(text),
  hand: /hand icon/.test(extra ?? ""),
}));

afterEach(cleanup);

describe("the seven §12.2 chips", () => {
  it("are all in the brand table and in the component", () => {
    expect(ROWS).toHaveLength(7);
    expect(Object.values(CHIPS).map((c) => c.label).sort()).toEqual(ROWS.map((r) => r.label).sort());
  });

  it.each(ROWS)("$label renders with $fill fill and $text text", ({ label, fill, text, hand }) => {
    const kind = (Object.keys(CHIPS) as ChipKind[]).find((k) => CHIPS[k].label === label)!;
    render(<Chip kind={kind} />);
    const chip = screen.getByText(label).closest("[data-chip]")!;
    expect(chip.getAttribute("data-chip")).toBe(kind);
    expect(chip.classList).toContain(`bg-${fill}`);
    expect(chip.classList).toContain(`text-${text}`);
    expect([...chip.classList].filter((c) => /^(bg|text)-(?!chip$)/.test(c))).toEqual([`bg-${fill}`, `text-${text}`]);
    expect(chip.querySelector("svg.lucide-hand") !== null).toBe(hand);
  });

  it("carry their label as text, never colour alone", () => {
    for (const kind of Object.keys(CHIPS) as ChipKind[]) {
      const { container } = render(<Chip kind={kind} />);
      expect(container.textContent).toBe(CHIPS[kind].label);
      cleanup();
    }
  });
});
