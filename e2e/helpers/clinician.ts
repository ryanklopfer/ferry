import { expect, type Page } from "@playwright/test";
import { signInLinkFor } from "./outbox";

// Home → Start free → I'm a clinician → email → magic link. Returns on the first onboarding step.
export async function startFree(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("link", { name: /^Start free/ }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL((u) => u.pathname === "/start");
  await page.getByRole("link", { name: "I'm a clinician" }).click();
  await expect(page.getByRole("heading", { name: "Start free." })).toBeVisible();

  const fields = page.locator("main input:not([type=hidden]), main select, main textarea");
  await expect(fields).toHaveCount(1);
  await expect(fields.first()).toHaveAttribute("type", "email");
  await expect(page.locator('input[autocomplete^="cc-"], input[name*="card" i], input[type="password"]')).toHaveCount(0);

  await page.getByLabel("Your work email").fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.getByText("Check your email.")).toBeVisible();
  await page.goto(await signInLinkFor(email));
  await expect(page).toHaveURL((u) => u.pathname === "/app/welcome");
}

export async function agree(page: Page) {
  await expect(page.getByRole("heading", { name: "First, the paperwork." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terms of service" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business associate agreement" })).toBeVisible();
  await page.getByLabel("Type your full name to sign").fill("Rachel Steinberg");
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page.getByRole("heading", { name: "Your practice." })).toBeVisible();
}
