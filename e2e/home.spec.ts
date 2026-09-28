import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const overflow = (page: Page) => page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));

async function open(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

// Every multi-column grid on the page (not the three-segment progress bars) stacks its visible children.
const columnsPerGrid = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main .grid, footer.grid")]
      .filter((grid) => !grid.matches('[aria-label="Progress"]'))
      .map((grid) => {
        const lefts = [...grid.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => Math.round(r.left));
        return { grid: grid.className.slice(0, 60), columns: new Set(lefts).size, children: lefts.length };
      }),
  );

// Until N7a's assertNoPhi exists: the words that would reveal care if the message reached someone else.
const HEALTH_WORDS = /therap|psych|counsel|session|diagnos|mental|health|anxi|depress|trauma|medic|patient|treatment|clinic|symptom|disorder|prescri|\bcare\b|\bCPT\b|\bICD\b|\bnotes? about\b/i;

test.describe("homepage layout", () => {
  test("at 390 px it is one column with nothing wider than the viewport", async ({ page }) => {
    await open(page, "/", 390);
    const grids = await columnsPerGrid(page);
    expect(grids.length).toBeGreaterThanOrEqual(8);
    expect(grids.filter((g) => g.columns > 1)).toEqual([]);
    const { scroll, viewport } = await overflow(page);
    expect(viewport).toBe(390);
    expect(scroll).toBeLessThanOrEqual(390);
  });

  test("the same grids really do go to columns on a desktop", async ({ page }) => {
    await open(page, "/", 1280);
    expect((await columnsPerGrid(page)).filter((g) => g.columns > 1).length).toBeGreaterThanOrEqual(6);
  });

  test("survives 130% text at 390 px", async ({ page }) => {
    await open(page, "/", 390);
    const heading = page.getByRole("heading", { level: 1 });
    const before = await heading.evaluate((h) => parseFloat(getComputedStyle(h).fontSize));
    await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
    expect(await heading.evaluate((h) => parseFloat(getComputedStyle(h).fontSize))).toBeCloseTo(before * 1.3, 0);
    const { scroll, viewport } = await overflow(page);
    expect(scroll).toBeLessThanOrEqual(viewport);
  });

  test("capture tabs are buttons with aria-pressed, each showing its own panel", async ({ page }) => {
    await open(page, "/", 390);
    const group = page.getByRole("group", { name: "Ways to capture" });
    const tabs = group.getByRole("button");
    await expect(tabs).toHaveText(["Live session", "Dictate a summary", "Type rough notes", "Scan a document"]);
    for (const tab of await tabs.all()) await expect(tab).toHaveAttribute("aria-pressed", /^(true|false)$/);
    await expect(tabs.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-panel="live"]')).toBeVisible();
    await expect(page.locator('[data-panel="dictate"]')).toBeHidden();

    await group.getByRole("button", { name: "Dictate a summary" }).click();
    await expect(group.getByRole("button", { name: "Dictate a summary" })).toHaveAttribute("aria-pressed", "true");
    await expect(tabs.first()).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('[data-panel="dictate"]')).toBeVisible();
    await expect(page.locator('[data-panel="live"]')).toBeHidden();
  });

  test("the FAQ uses details/summary", async ({ page }) => {
    await open(page, "/", 390);
    const faq = page.locator("section", { has: page.getByRole("heading", { name: "Questions" }) });
    const items = faq.locator("details");
    await expect(items).toHaveCount(4);
    await expect(faq.locator("details > summary")).toHaveCount(4);
    await expect(items.first()).toHaveAttribute("open", "");
    await expect(items.nth(1)).not.toHaveAttribute("open");
    await items.nth(1).locator("summary").click();
    await expect(items.nth(1)).toHaveAttribute("open", "");
    await expect(items.nth(1).getByText("Then don't record.")).toBeVisible();
  });

  for (const width of [390, 1280]) {
    test(`axe finds no violations at ${width} px`, async ({ page }) => {
      await open(page, "/", width);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
});

test.describe("public pages load nothing from elsewhere", () => {
  for (const path of ["/", "/for-clients", "/legal/terms"]) {
    test(`no request to a third-party origin on ${path}`, async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const requests: string[] = [];
      page.on("request", (r) => requests.push(r.url()));
      await page.goto(path, { waitUntil: "networkidle" });
      await page.mouse.wheel(0, 20_000);
      await page.waitForLoadState("networkidle");
      expect(requests.length).toBeGreaterThan(3);
      expect(requests.filter((u) => /^(https?|wss?):/.test(u) && new URL(u).origin.replace(/^ws/, "http") !== origin)).toEqual([]);
    });
  }
});

test.describe("/for-clients", () => {
  test("is reachable signed out from the homepage footer", async ({ page }) => {
    await page.context().clearCookies();
    await open(page, "/", 390);
    await page.getByRole("contentinfo").getByRole("link", { name: "Clients" }).click();
    await expect(page).toHaveURL(/\/for-clients$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("is reachable signed out from /start", async ({ page }) => {
    await page.context().clearCookies();
    await open(page, "/start", 390);
    await page.getByRole("link", { name: "I'm a client" }).click();
    await expect(page).toHaveURL(/\/for-clients$/);
    await expect(page.getByRole("link", { name: "Invite your therapist" }).or(page.getByRole("button", { name: "Invite your therapist" }))).toBeVisible();
  });

  test("without Web Share, the share action is a mail draft with no health words", async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
    });
    await open(page, "/for-clients", 390);
    const link = page.getByRole("link", { name: "Invite your therapist" });
    await expect(link).toHaveAttribute("href", new RegExp(`${encodeURIComponent(`${new URL(baseURL!).origin}/`)}$`));
    const href = new URL((await link.getAttribute("href"))!);
    expect(href.protocol).toBe("mailto:");
    expect(href.pathname).toBe("");
    const subject = href.searchParams.get("subject")!;
    const body = href.searchParams.get("body")!;
    expect(body.length).toBeGreaterThan(40);
    expect(`${subject} ${body}`).not.toMatch(HEALTH_WORDS);
  });

  test("with Web Share, the share sheet gets the same message and no health words", async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", {
        configurable: true,
        value: (data: ShareData) => {
          (window as unknown as { shared: ShareData[] }).shared = [...((window as unknown as { shared?: ShareData[] }).shared ?? []), data];
          return Promise.resolve();
        },
      });
    });
    await open(page, "/for-clients", 390);
    await page.getByRole("button", { name: "Invite your therapist" }).click();
    const shared = await page.evaluate(() => (window as unknown as { shared: ShareData[] }).shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].url).toBe(`${new URL(baseURL!).origin}/`);
    expect(`${shared[0].title} ${shared[0].text}`).not.toMatch(HEALTH_WORDS);
    expect(HEALTH_WORDS.test("Could you see my therapist about a session?")).toBe(true);
  });
});
