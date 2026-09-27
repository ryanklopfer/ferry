import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "@/server/db";
import { createTestUser, resetDb, signedInHeaders } from "@/server/db/testing";
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
});
