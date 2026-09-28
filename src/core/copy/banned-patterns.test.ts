import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ForClientsPage from "@/app/(public)/for-clients/page";
import LegalPage from "@/app/(public)/legal/[doc]/page";
import StartPage from "@/app/(public)/start/page";
import { HomePage } from "@/ui/home/home-page";
import { PublicPage } from "@/ui/home/site-chrome";
import { copySources } from "@/test-support/copy-sources";
import { htmlText } from "./html-text";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

const SOURCES = copySources(__filename);

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => htmlText(renderToStaticMarkup(el));

async function publicPages(): Promise<Record<string, string>> {
  const legal = async (doc: string) => render(createElement(PublicPage, null, await LegalPage({ params: Promise.resolve({ doc }), searchParams: Promise.resolve({}) })));
  return {
    "/": render(createElement(HomePage, { prelaunch: false })),
    "/ (prelaunch)": render(createElement(HomePage, { prelaunch: true })),
    "/for-clients": render(createElement(PublicPage, null, createElement(ForClientsPage))),
    "/start": render(createElement(PublicPage, null, await StartPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }))),
    "/legal/terms": await legal("terms"),
    "/legal/privacy": await legal("privacy"),
  };
}

// P0-1.4 and R3: nothing that claims popularity or praise until it is real.
const SOCIAL_PROOF = [
  /\breviews?\b/i,
  /\btestimonials?\b/i,
  /[★☆⭐]/,
  /\b\d(?:\.\d)?\s*(?:\/\s*5|out of 5|stars?)\b/i,
  /\bstar ratings?\b/i,
  /\brated\b/i,
  /\btrusted by\b/i,
  /\b(?:join|over|more than)\s+\d[\d,.]*\s*k?\+?/i,
  /\b\d[\d,.]*\s*k?\+?\s+(?:clinicians|therapists|psychiatrists|practices|users|customers|clients|people|members|notes|claims)\b/i,
  /["“][^"”]{12,}["”]\s*[—–-]\s*[A-Z][a-z]+/,
];

const HIPAA_COMPLIANT = new RegExp(["HIPAA", "[\\s-]+compliant"].join(""), "i");

const socialProof = (text: string) => SOCIAL_PROOF.filter((re) => re.test(text)).map(String);

describe("banned patterns", () => {
  it("no reviews, testimonials, star ratings or user counts on any public page", async () => {
    const pages = await publicPages();
    for (const [url, text] of Object.entries(pages)) {
      expect(text.length, url).toBeGreaterThan(50);
      expect(socialProof(text), url).toEqual([]);
    }
  });

  it("the checker catches each kind", () => {
    for (const bad of [
      "Read our reviews",
      "What clinicians say: testimonials",
      "★★★★★",
      "Rated 4.9/5 by therapists",
      "4.8 stars on the App Store",
      "Trusted by practices nationwide",
      "Join 2,000+ clinicians",
      "Over 10k notes written",
      "1,200 therapists use Ferry",
      '"It changed my practice." — Dana',
    ]) {
      expect(socialProof(bad), bad).not.toEqual([]);
    }
  });

  it("'Signed BAA on every plan' is on the homepage", async () => {
    const pages = await publicPages();
    expect(pages["/"]).toContain("Signed BAA on every plan.");
    expect(pages["/ (prelaunch)"]).toContain("Signed BAA on every plan.");
  });

  it("'HIPAA compliant' appears nowhere in src/, content/ or a public page (Q-L4)", async () => {
    expect(SOURCES.length).toBeGreaterThan(100);
    expect(SOURCES.filter(({ text }) => HIPAA_COMPLIANT.test(text)).map((s) => s.file)).toEqual([]);
    for (const [url, text] of Object.entries(await publicPages())) expect(HIPAA_COMPLIANT.test(text), url).toBe(false);
    expect(HIPAA_COMPLIANT.test("Fully HIPAA-compliant")).toBe(true);
  });
});
