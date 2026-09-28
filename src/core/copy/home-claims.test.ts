import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomePage } from "@/ui/home/home-page";
import { type Claim, HOME_CLAIMS, LABELS, type Proof } from "./home-claims";
import { textBlocks } from "./html-text";

const ROOT = process.cwd();
const plan = fs.readFileSync(path.join(ROOT, "docs/sprint-tasks.md"), "utf8");

const blocks = (prelaunch: boolean) => [...new Set(textBlocks(renderToStaticMarkup(createElement(HomePage, { prelaunch }))))];

function unmapped(pageBlocks: string[], claims: Record<string, Claim>, labels: Set<string>): string[] {
  return pageBlocks.filter((b) => !Object.hasOwn(claims, b) && !labels.has(b));
}

// The slice's own section of the plan: "### [ ] S12 — ..." up to the next "### ".
function sliceSection(slice: string): string | null {
  const start = plan.search(new RegExp(`^### \\[[ x]\\] ${slice} — `, "m"));
  if (start === -1) return null;
  const rest = plan.slice(start + 4);
  const next = rest.search(/^### /m);
  return next === -1 ? rest : rest.slice(0, next);
}

// Every repo file, so a later slice's proof must exist once that slice is ticked done.
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (["node_modules", ".next", ".git", "test-results"].includes(e.name)) return [];
    const full = path.join(dir, e.name);
    return e.isDirectory() ? files(full) : [path.relative(ROOT, full)];
  });
}
const REPO = files(ROOT);

function proofProblem({ slice, test }: Proof): string | null {
  const section = sliceSection(slice);
  if (!section) return `${slice} is not a slice in docs/sprint-tasks.md`;
  const [file, name] = test.split(" > ");
  if (name !== undefined) {
    if (!fs.existsSync(path.join(ROOT, file))) return `${file} does not exist`;
    return fs.readFileSync(path.join(ROOT, file), "utf8").includes(name) ? null : `${file} has no test named "${name}"`;
  }
  if (!section.includes(file)) return `${slice}'s acceptance in docs/sprint-tasks.md never names ${file}`;
  const done = /^\[x\]/.test(section);
  if (done && !REPO.some((f) => f === file || f.endsWith(`/${file}`))) return `${slice} is done but ${file} does not exist`;
  return null;
}

describe("homepage promises", () => {
  it("every promise sentence on the page maps to a test or to flagged-for-Ryan", () => {
    for (const prelaunch of [false, true]) expect(unmapped(blocks(prelaunch), HOME_CLAIMS, LABELS), `prelaunch: ${prelaunch}`).toEqual([]);
  });

  it("an unmapped sentence fails", () => {
    expect(unmapped([...blocks(false), "Get paid in 24 hours, guaranteed."], HOME_CLAIMS, LABELS)).toEqual(["Get paid in 24 hours, guaranteed."]);
  });

  it("every mapped sentence is still on the page, and no sentence is both a promise and a label", () => {
    const onPage = new Set(blocks(false));
    expect(Object.keys(HOME_CLAIMS).filter((s) => !onPage.has(s))).toEqual([]);
    expect(Object.keys(HOME_CLAIMS).filter((s) => LABELS.has(s))).toEqual([]);
  });

  it("every proof is an existing test id, or one a later slice's acceptance names", () => {
    const problems = Object.entries(HOME_CLAIMS).flatMap(([sentence, claim]) =>
      "proof" in claim ? claim.proof.map(proofProblem).filter(Boolean).map((p) => `${sentence}: ${p}`) : [],
    );
    expect(Object.values(HOME_CLAIMS).every((c) => "flag" in c || c.proof.length > 0)).toBe(true);
    expect(problems).toEqual([]);
  });

  it("the checker refuses a proof nobody plans to write", () => {
    expect(proofProblem({ slice: "N6", test: "made-up.test.ts" })).toMatch(/never names/);
    expect(proofProblem({ slice: "S11c", test: "src/core/copy/pricing-grep.test.ts > a test that isn't there" })).toMatch(/no test named/);
    expect(proofProblem({ slice: "Z9", test: "x.test.ts" })).toMatch(/not a slice/);
  });

  it("prints the flagged list", () => {
    const flagged = Object.entries(HOME_CLAIMS).flatMap(([sentence, claim]) => ("flag" in claim ? [`- "${sentence}": ${claim.why}`] : []));
    expect(flagged.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(HOME_CLAIMS).filter((s) => "flag" in HOME_CLAIMS[s])).toEqual(expect.arrayContaining([expect.stringContaining("Record in the room or on video"), "Unlimited notes and dictation"]));
    process.stdout.write(`\nHomepage promises flagged for Ryan (${flagged.length}):\n${flagged.join("\n")}\n`);
  });
});
