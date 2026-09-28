import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { pool } from "@/server/db";
import { resetDb } from "@/server/db/testing";
import { agree, startFree } from "./helpers/clinician";

test.describe.configure({ mode: "serial" });

const TAX_ID = "900-11-4242";
// The outbox outlives a run, so every address is new.
const tag = randomBytes(4).toString("hex");

async function onboard(page: Page, email: string) {
  await startFree(page, email);
  await agree(page);

  await page.getByLabel("Your name as it appears on your license").fill("Rachel Steinberg");
  await page.getByLabel("Credential").fill("LCSW");
  await page.getByLabel("Specialty").selectOption({ label: "Clinical social worker" });
  await page.getByLabel("License state").selectOption("CA");
  await page.getByLabel("License number").fill("LCS 88213");
  await page.getByLabel("Your individual NPI").fill("1999000024");
  await page.getByLabel("Tax ID type").selectOption("SSN");
  await page.getByLabel("Tax ID", { exact: true }).fill(TAX_ID);
  await page.getByLabel("Street address").fill("2 Practice St");
  await page.getByLabel("City").fill("Oakland");
  await page.getByLabel("State", { exact: true }).selectOption("CA");
  await page.getByLabel("ZIP code").fill("94610");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That NPI doesn't check out." })).toBeVisible();
  await expect(page.getByLabel("Your name as it appears on your license")).toHaveValue("Rachel Steinberg");

  await page.getByLabel("Your individual NPI").fill("1999000023");
  await page.getByLabel("Tax ID", { exact: true }).fill(TAX_ID);
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByRole("heading", { name: "Your session fees." })).toBeVisible();
  await page.getByLabel(/^Therapy, about 60 minutes/).fill("175");
  await page.getByLabel(/^Intake assessment 90791/).fill("225.50");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByRole("heading", { name: "Last step: let us file for you." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Filing authorization" })).toBeVisible();
  await page.getByLabel("Type your full name to sign").fill("Rachel Steinberg");
  await page.getByRole("button", { name: "Sign and finish" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/app");
  await expect(page.getByRole("heading", { name: "Your clients" })).toBeVisible();
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [390, 1280]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });

    test("Start free asks for an email and nothing else; no card field exists; onboarding completes", async ({ page }) => {
      await resetDb();
      const email = `clinician-${width}-${tag}@example.test`;
      await onboard(page, email);
      await noHorizontalScroll(page);

      const { rows } = await pool.query<{ role: string; doc_type: string }>(
        "select u.role, c.doc_type from users u join clinician_consents c on c.user_id = u.id where u.email = $1 order by c.doc_type",
        [email],
      );
      expect(rows.map((r) => [r.role, r.doc_type])).toEqual([
        ["clinician", "baa"],
        ["clinician", "npi_filing_authorization"],
        ["clinician", "terms"],
      ]);
      const profile = await pool.query("select onboarded_at, tax_id, tax_id_last4 from clinician_profiles p join users u on u.id = p.user_id where u.email = $1", [email]);
      expect(profile.rows[0].onboarded_at).not.toBeNull();
      expect(profile.rows[0].tax_id).toMatch(/^v1\./);
      expect(profile.rows[0].tax_id_last4).toBe("4242");
    });

    test("profile pages show only the last four of the Tax ID", async ({ page }) => {
      await resetDb();
      await onboard(page, `profile-${width}-${tag}@example.test`);

      await page.getByRole("link", { name: "Practice details" }).click();
      await expect(page).toHaveURL((u) => u.pathname === "/app/account/profile");
      await expect(page.getByText("On file: ending 4242. Leave blank to keep it.")).toBeVisible();
      await expect(page.getByLabel("Tax ID", { exact: true })).toHaveValue("");
      const html = await page.content();
      for (const whole of ["900114242", "900-11-4242", "90011"]) expect(html).not.toContain(whole);
      await noHorizontalScroll(page);

      await page.getByLabel("Credential").fill("LCSW-C");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();
      await expect(page.getByLabel("Credential")).toHaveValue("LCSW-C");
      await expect(page.getByText("On file: ending 4242. Leave blank to keep it.")).toBeVisible();

      await page.goto("/app/account/fees");
      await expect(page.getByLabel(/^Therapy, about 60 minutes/)).toHaveValue("175");
      await expect(page.getByLabel(/^Intake assessment 90791/)).toHaveValue("225.50");
      expect(await page.content()).not.toContain("900114242");
    });
  });
}
