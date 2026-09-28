import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomePage } from "@/ui/home/home-page";
import { HOME } from "./home";
import { AWAITING, type Claim, HOME_CLAIMS, LABELS, type Proof } from "./home-claims";
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

// The test's own title in its file, in any quote style.
function hasTest(file: string, name: string): boolean {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  return ['"', "'", "`"].some((q) => text.includes(`${q}${name}${q}`));
}

// A proof must exist today as "file > test name". A planned proof may also be a bare test file, but only one a
// later slice's acceptance names and only while that slice is open: once it is ticked done, name the real test.
function proofProblem({ slice, test }: Proof, planned: boolean): string | null {
  const section = sliceSection(slice);
  if (!section) return `${slice} is not a slice in docs/sprint-tasks.md`;
  const [file, name] = test.split(" > ");
  if (name !== undefined) {
    if (!fs.existsSync(path.join(ROOT, file))) return `${file} does not exist`;
    return hasTest(file, name) ? null : `${file} has no test named "${name}"`;
  }
  if (!planned) return `${file} is only a plan: a proof names a test that exists ("file > test name"), or the promise is flagged`;
  if (!section.includes(file)) return `${slice}'s acceptance in docs/sprint-tasks.md never names ${file}`;
  if (/^\[x\]/.test(section)) return `${slice} is done: name the test in ${file} that proves this ("file > test name")`;
  return null;
}

const problems = (claims: Record<string, Claim>) =>
  Object.entries(claims).flatMap(([sentence, claim]) => {
    const proofs: [Proof, boolean][] = "proof" in claim ? claim.proof.map((p) => [p, false]) : (claim.planned ?? []).map((p) => [p, true]);
    return proofs.map(([p, planned]) => proofProblem(p, planned)).filter(Boolean).map((p) => `${sentence}: ${p}`);
  });

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

  it("every promise is proven by a test that exists today, or flagged-for-Ryan", () => {
    expect(Object.values(HOME_CLAIMS).every((c) => ("proof" in c ? c.proof.length > 0 : c.why.length > 0 && (c.why !== AWAITING || (c.planned ?? []).length > 0)))).toBe(true);
    expect(problems(HOME_CLAIMS)).toEqual([]);
  });

  it("the checker refuses a proof that isn't a test yet, and a plan nobody will write", () => {
    const real = "src/core/copy/pricing-grep.test.ts > nothing is priced by the claim in src/ or content/";
    expect(proofProblem({ slice: "S11c", test: real }, false)).toBeNull();
    expect(proofProblem({ slice: "N6", test: "entitlements.test.ts" }, false)).toMatch(/only a plan/);
    expect(proofProblem({ slice: "N6", test: "entitlements.test.ts" }, true)).toBeNull();
    expect(proofProblem({ slice: "N6", test: "made-up.test.ts" }, true)).toMatch(/never names/);
    expect(proofProblem({ slice: "S11c", test: "home-copy.test.ts" }, true)).toMatch(/S11c is done: name the test/);
    expect(proofProblem({ slice: "S11c", test: "src/core/copy/pricing-grep.test.ts > a test that isn't there" }, true)).toMatch(/no test named/);
    expect(proofProblem({ slice: "S11c", test: "src/core/copy/nowhere.test.ts > x" }, false)).toMatch(/does not exist/);
    expect(proofProblem({ slice: "Z9", test: "x.test.ts" }, true)).toMatch(/not a slice/);
    expect(problems({ "Audio deleted.": { proof: [{ slice: "N12", test: "no-audio.test.ts" }] } })).toEqual([expect.stringMatching(/^Audio deleted\.: .*only a plan/)]);
  });

  it("the BAA promise is not proven by its own copy", () => {
    const baa = ["No card needed. Signed BAA on every plan.", "Signed BAA", HOME.security.qa[0].a];
    for (const sentence of baa) {
      const claim = HOME_CLAIMS[sentence];
      const tests = "proof" in claim ? claim.proof : (claim.planned ?? []);
      expect(tests.map((t) => t.test).filter((t) => t.includes("banned-patterns")), sentence).toEqual([]);
      expect(tests, sentence).toEqual(expect.arrayContaining([{ slice: "N5", test: "src/server/services/clinician.test.ts > terms and BAA are stored with version and hash at sign-up" }]));
    }
  });

  it("prints the flagged list", () => {
    const entries = Object.entries(HOME_CLAIMS);
    const questions = entries.flatMap(([sentence, c]) => ("flag" in c && c.why !== AWAITING ? [`- "${sentence}": ${c.why}`] : []));
    const pending = entries.flatMap(([sentence, c]) => ("flag" in c && c.why === AWAITING ? [`- "${sentence}" ← ${(c.planned ?? []).map((p) => `${p.slice} ${p.test}`).join("; ")}`] : []));
    const proven = entries.filter(([, c]) => "proof" in c).map(([sentence]) => sentence);
    expect(questions.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(HOME_CLAIMS).filter((s) => "flag" in HOME_CLAIMS[s])).toEqual(
      expect.arrayContaining([expect.stringContaining("Record in the room or on video"), "Unlimited notes and dictation", "Most popular"]),
    );
    process.stdout.write(
      `\nHomepage promises flagged for Ryan: ${questions.length} questions, ${pending.length} awaiting a test; ${proven.length} proven.\n` +
        `Questions:\n${questions.join("\n")}\nAwaiting a test (planned proofs):\n${pending.join("\n")}\n`,
    );
  });
});
