import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "@/server/db";
import { createTestUser, resetDb, signedInHeaders } from "@/server/db/testing";
import { GET as packet } from "./claims/[id]/packet/route";
import { GET as superbill } from "./claims/[id]/superbill/route";
import { GET as claimDetail } from "./v1/claims/[id]/route";
import { GET as claimList } from "./v1/claims/route";

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));

const params = { params: Promise.resolve({ id: "clm_missing" }) } as never;
const routes = { claimList: () => claimList(), claimDetail: () => claimDetail(new Request("http://x"), params), packet: () => packet(new Request("http://x"), params), superbill: () => superbill(new Request("http://x"), params) };

// A client that re-authenticates on 401 would loop on a wrong-role session, so only a missing session is 401.
describe("clinician route handlers", () => {
  beforeEach(async () => {
    await resetDb();
    request.headers = new Headers();
  });
  afterAll(() => pool.end());

  it("answer 401 when signed out", async () => {
    for (const [name, call] of Object.entries(routes)) expect((await call()).status, name).toBe(401);
  });

  it("answer 404 to a signed-in user with any other role", async () => {
    for (const role of ["pending", "client", "staff"] as const) {
      await createTestUser(role, `${role}@example.test`);
      request.headers = await signedInHeaders(`${role}@example.test`);
      for (const [name, call] of Object.entries(routes)) expect((await call()).status, `${role} ${name}`).toBe(404);
    }
  });

  it("serve a clinician", async () => {
    await createTestUser("clinician", "dr@example.test");
    request.headers = await signedInHeaders("dr@example.test");
    expect((await routes.claimList()).status).toBe(200);
    expect((await routes.claimDetail()).status).toBe(404);
  });
});
