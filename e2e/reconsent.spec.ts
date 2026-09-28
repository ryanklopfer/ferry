import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { type ConsentDocType, LEGAL_SLUG } from "@/core/legal";
import { clientCtxFor } from "@/server/auth/client-ctx";
import { pool } from "@/server/db";
import { clientsRepo } from "@/server/db/repos/clients";
import { bindClientUser, createTestUser, resetDb, seedOnboardedClinician } from "@/server/db/testing";
import { liveText } from "@/server/legal";
import { recordConsent } from "@/server/services/consents";
import { E2E_LEGAL_DIR } from "./env";
import { signInLinkFor } from "./helpers/outbox";

// The servers read their legal texts from E2E_LEGAL_DIR (a copy of content/legal), so bumping a version here is a
// new version going live mid-session.
const file = (t: ConsentDocType) => path.join(E2E_LEGAL_DIR, `${LEGAL_SLUG[t]}.md`);
const bump = (t: ConsentDocType) =>
  fs.writeFileSync(file(t), fs.readFileSync(file(t), "utf8").replace(/^version: 0\.0\.0$/m, "version: 0.0.1") + "\nA sentence added in this version.\n");
const restore = (t: ConsentDocType) => fs.copyFileSync(path.join(process.cwd(), "content", "legal", `${LEGAL_SLUG[t]}.md`), file(t));

test.describe.configure({ mode: "serial" });

async function world() {
  await resetDb();
  const tag = randomBytes(4).toString("hex");
  const clinicianEmail = `clinician-${tag}@example.test`;
  const clientEmail = `client-${tag}@example.test`;
  const x = await createTestUser("clinician", clinicianEmail);
  await seedOnboardedClinician(x);
  const client = await clientsRepo.create(x, { firstName: "Ana", lastName: "Ortiz", dob: "1990-04-02", email: clientEmail, phone: null });
  const self = await createTestUser("client", clientEmail);
  const membershipId = await bindClientUser(x, client.id, self);
  const k = await clientCtxFor(self, membershipId);
  for (const docType of ["client_filing", "client_recording"] as const) {
    await recordConsent(k, { docType, typedName: "Ana Ortiz", shownHash: (await liveText(docType)).hash, signerRelationship: "self", ip: null, userAgent: null });
  }
  await recordConsent(x, { docType: "npi_filing_authorization", typedName: "Rachel Steinberg", shownHash: (await liveText("npi_filing_authorization")).hash, ip: null, userAgent: null });
  return { x, clinicianEmail, clientEmail, clientId: client.id, membershipId };
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.getByText("Check your email.")).toBeVisible();
  await page.goto(await signInLinkFor(email));
}

// The pool stays open: the worker runs the other spec files in this same process, and smoke.spec.ts ends it.
test.afterAll(() => {
  for (const t of ["npi_filing_authorization", "client_recording"] as const) restore(t);
});

test("after a text version bump, the next gated action shows the re-consent screen; accepting it resumes the action", async ({ page }) => {
  const { x, clinicianEmail, clientId } = await world();
  await signIn(page, clinicianEmail);
  await expect(page).toHaveURL((u) => u.pathname === "/app");

  const gated = `/e2e-fixtures/gated?client=${clientId}`;
  await page.goto(gated);
  await expect(page.getByRole("heading", { name: "The gated action ran." })).toBeVisible();

  bump("npi_filing_authorization");
  await page.goto(gated);
  await expect(page).toHaveURL((u) => u.pathname === "/app/reconsent" && u.searchParams.get("next") === gated);
  await expect(page.getByRole("heading", { name: "We've updated our terms." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Filing authorization" })).toBeVisible();
  await expect(page.getByText("A sentence added in this version.")).toBeVisible();

  await page.getByRole("button", { name: "I agree" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/app/reconsent");
  await page.getByLabel("Type your full name to sign").fill("Rachel Steinberg");
  await page.getByRole("button", { name: "I agree" }).click();

  await expect(page).toHaveURL((u) => u.pathname === "/e2e-fixtures/gated" && u.search === `?client=${clientId}`);
  await expect(page.getByRole("heading", { name: "The gated action ran." })).toBeVisible();
  const { rows } = await pool.query<{ version: string }>("select version from clinician_consents where user_id = $1 and doc_type = 'npi_filing_authorization' order by created_at", [x.userId]);
  expect(rows.map((r) => r.version)).toEqual(["0.0.0", "0.0.1"]);
});

test("a client whose consent text changed re-consents at sign-in, then lands home", async ({ page }) => {
  const { x, clientEmail, clientId, membershipId } = await world();
  bump("client_recording");
  await signIn(page, clientEmail);

  await expect(page).toHaveURL((u) => u.pathname === "/c/reconsent" && u.searchParams.get("m") === membershipId);
  await expect(page.getByRole("heading", { name: "We've updated a consent." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consent to record sessions" })).toBeVisible();
  await expect(page.getByText("Audio is never stored.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consent to file claims" })).toHaveCount(0);

  await page.getByRole("radio", { name: "Me" }).check();
  await page.getByLabel("Type your full name to sign").fill("Ana Ortiz");
  await page.getByRole("button", { name: "I agree" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/c");

  const { rows } = await pool.query<{ version: string; signer_relationship: string }>(
    "select version, signer_relationship from client_consents where user_id = $1 and client_id = $2 and doc_type = 'client_recording' order by created_at",
    [x.userId, clientId],
  );
  expect(rows).toEqual([
    { version: "0.0.0", signer_relationship: "self" },
    { version: "0.0.1", signer_relationship: "self" },
  ]);
});
