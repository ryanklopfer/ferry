import { expect, test } from "@playwright/test";
import { pool } from "@/server/db";
import { resetDb } from "@/server/db/testing";

test.afterAll(() => pool.end());

test("resetDb accepts the e2e database", async () => {
  const { rows } = await pool.query<{ name: string }>("select current_database() as name");
  expect(rows[0].name).toBe("ferry_e2e_test");
  await resetDb();
});

test("the sign-in page loads", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Let's get you in." })).toBeVisible();
  await expect(page.getByLabel("Your email")).toBeVisible();
});
