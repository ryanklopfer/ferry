import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copySources } from "@/test-support/copy-sources";
import { htmlText } from "./html-text";

const SOURCES = copySources(__filename);

const grep = (re: RegExp) => SOURCES.flatMap(({ file, text }) => [...text.matchAll(re)].map((m) => `${file}: ${m[0]}`));

async function renderHome(pricing: { monthlyCents: number; trialDays: number }) {
  vi.resetModules();
  vi.doMock("@/core/billing/pricing", async (original) => ({ ...(await original<typeof import("@/core/billing/pricing")>()), PRICING: pricing }));
  const { HomePage } = await import("@/ui/home/home-page");
  return htmlText(renderToStaticMarkup(createElement(HomePage, { prelaunch: false })));
}

// "$126.00" is the sample client's claim in the hero illustration, not a price.
const EXAMPLE_AMOUNTS = ["$126.00"];
const dollars = (text: string) => [...text.matchAll(/\$[\d,]+(?:\.\d+)?/g)].map((m) => m[0]).filter((a) => !EXAMPLE_AMOUNTS.includes(a));

describe("pricing on the page", () => {
  afterEach(() => {
    vi.doUnmock("@/core/billing/pricing");
    vi.resetModules();
  });

  it("every price and trial length on the page renders from PRICING", async () => {
    const standard = await renderHome({ monthlyCents: 5000, trialDays: 7 });
    expect(dollars(standard).sort()).toEqual(["$0", "$50", "$50"]);
    expect(standard).toContain("Free for 7 days, then $50 a month.");
    expect(standard).toContain("Seven days free.");

    const changed = await renderHome({ monthlyCents: 7350, trialDays: 11 });
    expect(dollars(changed).sort()).toEqual(["$0", "$73.50", "$73.50"]);
    expect(changed).toContain("Free for 11 days, then $73.50 a month.");
    expect(changed).toContain("Eleven days free.");
    expect(changed).toContain("Start free for 11 days");
    expect(changed).not.toMatch(/\$50\b|\b7 days|Seven/);
  });

  it("no '$9' in src/ or content/", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
    expect(grep(/\$9(?!\d)/g)).toEqual([]);
  });

  it("nothing is priced by the claim in src/ or content/", () => {
    const hits = grep(/(?:No )?per[\s-]claim(?: fees\.)?/gi);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.filter((hit) => !hit.endsWith(": No per-claim fees."))).toEqual([]);
  });
});
