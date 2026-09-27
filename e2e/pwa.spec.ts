import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, expect, type Page, test } from "@playwright/test";
import { cachePolicy } from "@/core/pwa/cache-policy";
import { signInLinkFor } from "./helpers/outbox";

const cachedPaths = (page: Page) =>
  page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push(r.url);
    return out;
  });

async function controlledByWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

test("the app shell loads signed out", async ({ request }) => {
  for (const path of ["/manifest.webmanifest", "/sw.js", "/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]) {
    const r = await request.get(path, { maxRedirects: 0 });
    expect(r.status(), path).toBe(200);
  }
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Ferry", start_url: "/home", display: "standalone", theme_color: "#FFF6EC" });
});

test("a page that can't load offline shows the offline page", async ({ page, context }) => {
  await page.goto("/sign-in");
  await controlledByWorker(page);
  await context.setOffline(true);
  try {
    await page.goto("/start");
    await expect(page.getByRole("heading", { name: "No signal right now." })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

// The headless shell always answers [] and every Playwright context is incognito, which is never installable.
// Full Chromium (new headless) with a real profile runs the same check as the install menu.
test("Chromium finds no installability errors", async ({ baseURL }) => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "ferry-pwa-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chromium", baseURL });
  try {
    const page = await context.newPage();
    await page.goto("/sign-in");
    await controlledByWorker(page);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    expect(installabilityErrors).toEqual([]);

    // The same check does report a problem, so the empty answer above means something.
    await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.remove());
    expect((await cdp.send("Page.getInstallabilityErrors")).installabilityErrors.map((e) => e.errorId)).toContain("no-manifest");
  } finally {
    await context.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test("signed-in pages and the API never reach Cache Storage, and signing out empties it", async ({ page }) => {
  const address = `pwa-${randomBytes(4).toString("hex")}@example.test`;
  await page.goto("/sign-in");
  await page.getByLabel("Your email").fill(address);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.getByText("Check your email.")).toBeVisible();
  await page.goto(await signInLinkFor(address));
  await expect(page).not.toHaveURL(/sign-in/);
  await controlledByWorker(page);

  for (const path of ["/", "/account", "/app", "/app/clients", "/c", "/c/trips", "/i/tok_synthetic", "/api/v1/claims"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBeLessThan(500);
  }
  const noStore = await page.request.get("/api/v1/claims");
  expect(noStore.headers()["cache-control"]).toContain("no-store");
  await page.goto("/account");
  await page.evaluate(() => fetch("/api/v1/claims").then((r) => r.text()));

  const origin = new URL(page.url()).origin;
  const cached = await cachedPaths(page);
  expect(cached.map((u) => new URL(u).pathname)).toContain("/offline");
  expect(cached.filter((u) => /^\/(?:app|c|i|api)(?:\/|$)/.test(new URL(u).pathname))).toEqual([]);
  expect(cached.filter((u) => cachePolicy(u, origin) !== "precache")).toEqual([]);

  // The page sign-out lands on loads nothing, so anything in Cache Storage afterwards survived the sign-out.
  await page.context().route("**/sign-in", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>signed out</title>" }));
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/sign-in$/);
  await expect(page).toHaveTitle("signed out");
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  expect(await cachedPaths(page)).toEqual([]);
});
