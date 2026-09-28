import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { pool } from "@/server/db";
import { resetDb } from "@/server/db/testing";
import { agree, startFree } from "./helpers/clinician";

// Chrome's WebAuthn virtual authenticator (CDP) stands in for Face ID or Touch ID: a platform authenticator that
// holds discoverable credentials and always verifies the user.
test("after the first magic-link sign-in a passkey registers; after sign-out, sign-in with the passkey succeeds", async ({ page }) => {
  await resetDb();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  const email = `passkey-${randomBytes(4).toString("hex")}@example.test`;
  await startFree(page, email);
  await agree(page);

  const offer = page.getByRole("heading", { name: "Sign in with Face ID or Touch ID." });
  await expect(offer).toBeVisible();
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(offer).toHaveCount(0);
  expect((await cdp.send("WebAuthn.getCredentials", { authenticatorId })).credentials).toHaveLength(1);
  const { rows } = await pool.query("select p.id from passkeys p join users u on u.id = p.user_id where u.email = $1", [email]);
  expect(rows).toHaveLength(1);

  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/sign-in");
  await page.goto("/app/welcome");
  await expect(page).toHaveURL((u) => u.pathname === "/sign-in");

  await page.getByRole("button", { name: "Use a passkey instead" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/app/welcome");
  await expect(page.getByRole("heading", { name: "Your practice." })).toBeVisible();
});
