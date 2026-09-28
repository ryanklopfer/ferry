import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientCtxFor } from "@/server/auth/client-ctx";
import { signIntent } from "@/server/auth/intent";
import { pool } from "@/server/db";
import { clientsRepo } from "@/server/db/repos/clients";
import { bindClientUser, createTestUser, resetDb, signedInHeaders } from "@/server/db/testing";
import { liveText } from "@/server/legal";
import { recordConsent } from "@/server/services/consents";
import { tempLegalDir } from "@/test-support/legal-dir";
import HomePage from "./page";

const request = vi.hoisted(() => ({ headers: new Headers(), intent: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: (name: string) => (name === "ferry_signup_intent" && request.intent ? { name, value: request.intent } : undefined) }),
}));
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
    request.intent = undefined;
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

  it("sends a pending user part-way through Start free back to onboarding, and only with a valid intent for their email", async () => {
    await createTestUser("pending", "joining@example.test");
    request.headers = await signedInHeaders("joining@example.test");
    request.intent = signIntent("someone-else@example.test");
    await expect(HomePage()).rejects.toThrow("redirect:/start");
    request.intent = signIntent("joining@example.test");
    await expect(HomePage()).rejects.toThrow("redirect:/app/welcome");
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
      await expect(HomePage()).rejects.toThrow(`redirect:/c/reconsent?m=${m}&next=/home`);
    });

    it("asks for each clinician's stale consents in turn, coming back through /home", async () => {
      const self = await createTestUser("client", "u@example.test");
      const ms: string[] = [];
      for (const email of ["x@example.test", "y@example.test"]) {
        const clinician = await createTestUser("clinician", email);
        const client = await clientsRepo.create(clinician, { firstName: "Ana", lastName: "Ortiz", dob: "1990-04-02", email: null, phone: null });
        ms.push(await bindClientUser(clinician, client.id, self));
      }
      for (const m of ms) await recordConsent(await clientCtxFor(self, m), { docType: "client_filing", typedName: "Ana Ortiz", shownHash: (await liveText("client_filing")).hash, signerRelationship: "self", ip: null, userAgent: null });
      legal.bump("client_filing");
      request.headers = await signedInHeaders("u@example.test");
      for (const m of ms) {
        await expect(HomePage()).rejects.toThrow(`redirect:/c/reconsent?m=${m}&next=/home`);
        await recordConsent(await clientCtxFor(self, m), { docType: "client_filing", typedName: "Ana Ortiz", shownHash: (await liveText("client_filing")).hash, signerRelationship: "self", ip: null, userAgent: null });
      }
      await expect(HomePage()).rejects.toThrow(/^redirect:\/c$/);
    });

    it("still signs in a client one clinician has archived, and checks their other clinicians", async () => {
      const self = await createTestUser("client", "u@example.test");
      const x = await createTestUser("clinician", "x@example.test");
      const archived = await clientsRepo.create(x, { firstName: "Ana", lastName: "Ortiz", dob: "1990-04-02", email: null, phone: null });
      await bindClientUser(x, archived.id, self);
      await clientsRepo.archive(x, archived.id);
      request.headers = await signedInHeaders("u@example.test");
      await expect(HomePage()).rejects.toThrow(/^redirect:\/c$/);

      const y = await createTestUser("clinician", "y@example.test");
      const client = await clientsRepo.create(y, { firstName: "Ana", lastName: "Ortiz", dob: "1990-04-02", email: null, phone: null });
      const m = await bindClientUser(y, client.id, self);
      await recordConsent(await clientCtxFor(self, m), { docType: "client_filing", typedName: "Ana Ortiz", shownHash: (await liveText("client_filing")).hash, signerRelationship: "self", ip: null, userAgent: null });
      legal.bump("client_filing");
      await expect(HomePage()).rejects.toThrow(`redirect:/c/reconsent?m=${m}&next=/home`);
    });
  });
});
