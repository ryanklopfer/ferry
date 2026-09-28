import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomePage } from "@/ui/home/home-page";
import { AMENDMENTS, HOME, JOIN_BETA } from "./home";
import { htmlText } from "./html-text";

const spec = fs.readFileSync(path.join(process.cwd(), "docs/spec.html"), "utf8");

// The homepage frame: from the #screen-1 element to the end of its <figure>.
function specScreen1(): string {
  const start = spec.indexOf('id="screen-1"');
  expect(start).toBeGreaterThan(-1);
  const end = spec.indexOf("</figure>", start);
  return spec.slice(spec.indexOf(">", start) + 1, end);
}

const page = (prelaunch = false) => renderToStaticMarkup(createElement(HomePage, { prelaunch }));

function amendedSpecText(): string {
  let text = htmlText(specScreen1());
  for (const a of AMENDMENTS) {
    expect(text, `amendment "${a.spec}" still matches the spec`).toContain(a.spec);
    text = text.replace(a.spec, a.page);
  }
  return text;
}

describe("homepage copy", () => {
  it("the rendered text equals docs/spec.html #screen-1, apart from the AMENDMENTS list", () => {
    const expected = amendedSpecText();
    expect(expected.length).toBeGreaterThan(3000);
    expect(htmlText(page())).toBe(expected);
  });

  it("every amendment says why", () => {
    for (const a of AMENDMENTS) expect(a.why.length, a.spec).toBeGreaterThan(20);
  });

  it("the comparison notices a changed word", () => {
    const changed = htmlText(page()).replace("Stop charting.", "Stop charting now.");
    expect(changed).not.toBe(amendedSpecText());
  });

  it("prelaunch changes only the sign-up buttons: Log in goes, and every Start free becomes the beta email", () => {
    const html = page(true);
    const text = htmlText(html);
    expect(text).not.toMatch(/Start free|Log in/);
    expect(text.split(JOIN_BETA.label).length - 1).toBe(5);
    expect(html).not.toMatch(/href="\/(start|sign-in)"/);
    const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>(?:(?!<\/a>)[\s\S])*Join the beta/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(5);
    for (const href of hrefs) expect(href.replace(/&amp;/g, "&")).toBe(JOIN_BETA.href);
    expect(JOIN_BETA.href).toMatch(/^mailto:[^?]+@/);
  });

  it("signed out and live, Start free goes to /start and Log in to /sign-in", () => {
    const html = page();
    expect(html).toMatch(new RegExp(`href="/start"[^>]*>${HOME.startFree}<`));
    expect(html).toMatch(new RegExp(`href="/sign-in"[^>]*>${HOME.logIn.label}<`));
    expect(html).not.toContain("Join the beta");
  });

  it("Privacy and Terms go to /legal, Talk to us to the contact mailto, and the footer to /for-clients", () => {
    const html = page();
    expect(html).toMatch(/href="\/legal\/privacy"[^>]*>Privacy</);
    expect(html).toMatch(/href="\/legal\/terms"[^>]*>Terms</);
    expect(html).toMatch(/href="mailto:[^"]+"[^>]*>Talk to us</);
    expect(html).toMatch(/<footer[\s\S]*href="\/for-clients"[\s\S]*<\/footer>/);
  });
});
