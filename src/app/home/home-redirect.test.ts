import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientCtxFor } from "@/server/auth/client-ctx";
import { pool } from "@/server/db";
import { clientsRepo } from "@/server/db/repos/clients";
import { bindClientUser, createTestUser, resetDb, signedInHeaders } from "@/server/db/testing";
import { liveText } from "@/server/legal";
import { recordConsent } from "@/server/services/consents";
import { tempLegalDir } from "@/test-support/legal-dir";
import HomePage from "./page";

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

// The installed app opens at /home (manifest start_url), so this is where every signed-in user is sorted.
describe("/home", () => {
  beforeEach(async () => {
    await resetDb();
    request.headers = new Headers();
  });
  afterAll(() => pool.end());

  it.each([
    ["clinician", "/app"],
    ["client", "/c"],
    ["staff", "/ops"],
    ["pending", "/start"],
  ] as const)("sends a %s to %s", async (role, to) => {
    await createTestUser(role, `${role}@example.test`);
    request.headers = await signedInHeaders(`${role}@example.test`);
    await expect(HomePage()).rejects.toThrow(`redirect:${to}`);
  });

  it("sends a signed-out visitor to sign in", async () => {
    await expect(HomePage()).rejects.toThrow("redirect:/sign-in");
  });

  describe("with a consent signed to an earlier text", () => {
    let legal: ReturnType<typeof tempLegalDir>;
    beforeEach(() => void (legal = tempLegalDir()));
    afterEach(() => legal.restore());

    it("sends the clinician to re-consent before /app", async () => {
      const x = await createTestUser("clinician", "x@example.test");
      await recordConsent(x, { docType: "baa", typedName: "Rachel Steinberg", shownHash: (await liveText("baa")).hash, ip: null, userAgent: null });
      request.headers = await signedInHeaders("x@example.test");
      await expect(HomePage()).rejects.toThrow(/^redirect:\/app$/);
      legal.bump("baa");
      await expect(HomePage()).rejects.toThrow("redirect:/app/reconsent?next=/app");
    });

    it("sends the client to re-consent for that clinician before /c", async () => {
      const x = await createTestUser("clinician");
      const client = await clientsRepo.create(x, { firstName: "Ana", lastName: "Ortiz", dob: "1990-04-02", email: null, phone: null });
      const self = await createTestUser("client", "u@example.test");
      const m = await bindClientUser(x, client.id, self);
      await recordConsent(await clientCtxFor(self, m), { docType: "client_filing", typedName: "Ana Ortiz", shownHash: (await liveText("client_filing")).hash, signerRelationship: "self", ip: null, userAgent: null });
      request.headers = await signedInHeaders("u@example.test");
      await expect(HomePage()).rejects.toThrow(/^redirect:\/c$/);
      legal.bump("client_filing");
      await expect(HomePage()).rejects.toThrow(`redirect:/c/reconsent?m=${m}&next=/c`);
    });
  });
});
