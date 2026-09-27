import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, expect, type Page, test } from "@playwright/test";
import { cachePolicy, OFFLINE_PATH } from "@/core/pwa/cache-policy";
import { APP_ICONS } from "@/core/pwa/icons";
import { E2E_SPIKE_K } from "./env";
import { signInLinkFor } from "./helpers/outbox";

const SHELL = [OFFLINE_PATH, ...APP_ICONS.map((i) => i.src)].sort();

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

async function signIn(page: Page) {
  const address = `pwa-${randomBytes(4).toString("hex")}@example.test`;
  await page.goto("/sign-in");
  await page.getByLabel("Your email").fill(address);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.getByText("Check your email.")).toBeVisible();
  await page.goto(await signInLinkFor(address));
  await expect(page).not.toHaveURL(/sign-in/);
  await controlledByWorker(page);
}

test("the app shell loads signed out", async ({ request }) => {
  for (const path of ["/manifest.webmanifest", "/sw.js", "/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]) {
    const r = await request.get(path, { maxRedirects: 0 });
    expect(r.status(), path).toBe(200);
  }
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Ferry", start_url: "/home", display: "standalone", theme_color: "#FFF6EC" });
  // The suite's server runs with FERRY_SPIKE_K (e2e/mic-spike.spec.ts); the shared manifest must never hand it out.
  expect(JSON.stringify(manifest)).not.toContain(E2E_SPIKE_K);
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
  await signIn(page);

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

  // Sign-out finishes clearing before it navigates, so Cache Storage is read (from the worker) when that navigation
  // is requested. The page it lands on loads nothing, so afterwards the only entries are the public shell, which
  // the worker fetches again signed out for the offline fallback.
  const [worker] = page.context().serviceWorkers();
  let atSignOut: string[] | undefined;
  await page.context().route("**/sign-in", async (route) => {
    atSignOut = await worker.evaluate(() => caches.keys());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>signed out</title>" });
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/sign-in$/);
  await expect(page).toHaveTitle("signed out");
  expect(atSignOut).toEqual([]);
  await expect.poll(async () => (await cachedPaths(page)).map((u) => new URL(u).pathname).sort()).toEqual(SHELL);
});

test("after signing out, a page that can't load offline still shows the offline page", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/sign-in$/);
  await expect(page.getByLabel("Your email")).toBeVisible();
  await expect.poll(async () => (await cachedPaths(page)).map((u) => new URL(u).pathname)).toContain(OFFLINE_PATH);

  await context.setOffline(true);
  try {
    await page.goto("/start");
    await expect(page.getByRole("heading", { name: "No signal right now." })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
