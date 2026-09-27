import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { SCRUB_MARKER } from "@/app/e2e-fixtures/enabled";
import { e2eServerEnv } from "./env";
import { signInLinkFor } from "./helpers/outbox";

// A production build under `next start`, with the scrubber on: an Error whose message carries PHI must
// never reach the server's stdout or stderr, from a route handler or from a server action.
const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
let server: ChildProcess;
let output = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(600_000);
  const env = { ...process.env, ...e2eServerEnv(PORT), FERRY_SCRUB_ERRORS: "1", FERRY_E2E_FIXTURES: "1" };
  const build = spawnSync("bunx", ["next", "build"], { env: { ...env, NODE_ENV: "production" }, encoding: "utf8" });
  if (build.status !== 0) throw new Error(`next build failed:\n${build.stdout}\n${build.stderr}`);
  server = spawn("bunx", ["next", "start", "--port", String(PORT)], { env: { ...env, NODE_ENV: "production" } });
  server.stdout?.on("data", (d) => (output += d));
  server.stderr?.on("data", (d) => (output += d));
  for (let i = 0; i < 120; i++) {
    if (await fetch(`${BASE}/sign-in`).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`next start did not come up:\n${output}`);
});

test.afterAll(() => {
  server?.kill();
});

test("errors thrown with PHI in their message print only their name", async ({ page }) => {
  const address = `scrub-${randomBytes(4).toString("hex")}@example.test`;
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel("Your email").fill(address);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.getByText("Check your email.")).toBeVisible();
  await page.goto(await signInLinkFor(address));
  await expect(page).not.toHaveURL(/sign-in/);

  const route = await page.request.get(`${BASE}/e2e-fixtures/throw`);
  expect(route.status()).toBe(500);

  await page.goto(`${BASE}/e2e-fixtures/action`);
  const actionResponse = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/e2e-fixtures/action"));
  await page.getByRole("button", { name: "Run the failing action" }).click();
  expect((await actionResponse).status()).toBe(500);

  await expect.poll(() => (output.match(/"event":"request\.error"/g) ?? []).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  expect(server.exitCode).toBeNull();
  expect(output).not.toContain(SCRUB_MARKER);
  expect(output).not.toContain(address);
});
