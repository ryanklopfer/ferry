import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { E2E_SPIKE_K } from "./env";

const GALLERY = `/dev/ui?k=${E2E_SPIKE_K}`;
const WIDTHS = [390, 1280];

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(GALLERY);
  await expect(page.getByRole("heading", { level: 1, name: "UI gallery" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const overflow = (page: Page) => page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));

async function scaleText(page: Page, percent: number) {
  await page.addStyleTag({ content: `html { font-size: ${percent}% !important; }` });
}

test("the gallery is 404 without this run's key", async ({ request }) => {
  expect((await request.get("/dev/ui")).status()).toBe(404);
});

for (const width of WIDTHS) {
  test(`renders at ${width} px with nothing wider than the viewport`, async ({ page }) => {
    await open(page, width);
    const { scroll, viewport } = await overflow(page);
    expect(scroll).toBeLessThanOrEqual(viewport);
  });

  test(`survives 130% text at ${width} px`, async ({ page }) => {
    await open(page, width);
    const heading = page.getByRole("heading", { level: 1, name: "UI gallery" });
    const before = await heading.evaluate((h) => parseFloat(getComputedStyle(h).fontSize));
    await scaleText(page, 130);
    const after = await heading.evaluate((h) => parseFloat(getComputedStyle(h).fontSize));
    expect(after).toBeCloseTo(before * 1.3, 0);
    const { scroll, viewport } = await overflow(page);
    expect(scroll).toBeLessThanOrEqual(viewport);
  });
}

test("the wave drifts, and reduced motion stops it", async ({ page }) => {
  await open(page, 390);
  const wave = page.locator("[data-wave]").first();
  await expect(wave).toBeAttached();
  expect(await wave.evaluate((w) => getComputedStyle(w).animationName)).not.toBe("none");
  expect(await wave.evaluate((w) => getComputedStyle(w).animationDuration)).toBe("1.8s");

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await wave.evaluate((w) => getComputedStyle(w).animationName)).toBe("none");
});

test("chips are painted in their brand colours", async ({ page }) => {
  await open(page, 1280);
  const colour = (token: string) => page.evaluate((t) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${t})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, token);
  const expected: Record<string, [string, string]> = {
    quick: ["--ferry-blush", "--ferry-navy"],
    received: ["--ferry-blush", "--ferry-navy"],
    sent: ["--ferry-mint", "--ferry-sea-deep"],
    "on-its-way": ["--ferry-mint", "--ferry-sea-deep"],
    landed: ["--ferry-sea", "--ferry-white"],
    counted: ["--ferry-mint", "--ferry-sea-deep"],
    closed: ["--ferry-mist", "--ferry-slate"],
  };
  for (const [kind, [fill, text]] of Object.entries(expected)) {
    const chip = page.locator(`[data-chip="${kind}"]`).first();
    const painted = await chip.evaluate((c) => ({ bg: getComputedStyle(c).backgroundColor, fg: getComputedStyle(c).color }));
    expect(painted, kind).toEqual({ bg: await colour(fill), fg: await colour(text) });
  }
});

for (const width of WIDTHS) {
  test(`axe finds no violations at ${width} px`, async ({ page }) => {
    await open(page, width);
    // FERRY_BRAND §3 and §10 allow white on sea (3.1:1) for the bold 12px "Landed" chip only, so contrast skips it.
    const everything = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    const contrast = await new AxeBuilder({ page }).withRules(["color-contrast"]).exclude('[data-chip="landed"]').analyze();
    const violations = [...everything.violations, ...contrast.violations];
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    expect(contrast.passes.map((p) => p.id)).toContain("color-contrast");
  });
}

test("icon-only buttons have an aria-label", async ({ page }) => {
  await open(page, 390);
  const unlabeled = await page.evaluate(() =>
    [...document.querySelectorAll("button, a")]
      .filter((el) => !(el.textContent ?? "").trim() && el.querySelector("svg"))
      .filter((el) => !el.getAttribute("aria-label"))
      .map((el) => el.outerHTML.slice(0, 120)),
  );
  expect(unlabeled).toEqual([]);
  const iconOnly = await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => !(b.textContent ?? "").trim() && b.querySelector("svg")).length);
  expect(iconOnly).toBeGreaterThan(0);
});

test("every control is a real button, link or input", async ({ page }) => {
  await open(page, 1280);
  const fakes = () =>
    page.evaluate(() => {
      const NATIVE = "button, a[href], input, textarea, select, label";
      return [...document.querySelectorAll("body *")]
        .filter((el) => !el.closest(NATIVE))
        .filter((el) => getComputedStyle(el).cursor === "pointer" || el.hasAttribute("tabindex") || el.hasAttribute("onclick") || /^(button|link|tab|checkbox|radio|switch|menuitem)$/.test(el.getAttribute("role") ?? ""))
        .map((el) => el.outerHTML.slice(0, 120));
    });
  expect(await fakes()).toEqual([]);

  // The same check does catch a clickable div.
  await page.evaluate(() => document.querySelector("main")!.insertAdjacentHTML("beforeend", '<div style="cursor:pointer">fake</div>'));
  expect(await fakes()).toHaveLength(1);
  expect(await page.locator("[data-gallery-screen] button").count()).toBeGreaterThan(10);
});
