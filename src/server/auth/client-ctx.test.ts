import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as membershipRoute } from "@/app/api/v1/memberships/[id]/route";
import type { ClinicianCtx, SelfCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { clientsRepo } from "@/server/db/repos/clients";
import { bindClientUser, createTestUser, resetDb, signedInHeaders } from "@/server/db/testing";
import { NotOwnedError } from "@/server/errors";
import { clientCtxFor } from "./client-ctx";

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));

const get = (id: string) => membershipRoute(new Request("http://x"), { params: Promise.resolve({ id }) } as never);

describe("clientCtxFor", () => {
  let x: ClinicianCtx;
  let u: SelfCtx;
  let other: SelfCtx;
  let clientId: string;
  let membershipId: string;

  beforeEach(async () => {
    await resetDb();
    request.headers = new Headers();
    x = await createTestUser("clinician", "x@example.test");
    u = await createTestUser("client", "u@example.test");
    other = await createTestUser("client", "other@example.test");
    clientId = (await clientsRepo.create(x, { firstName: "Ana", lastName: "Ortiz", dob: "1990-04-02", email: "u@example.test", phone: null })).id;
    membershipId = await bindClientUser(x, clientId, u);
  });
  afterAll(() => pool.end());

  const sql = (text: string, values: unknown[]) => pool.query(text, values);

  // Each case breaks exactly one of rule 3's conditions on an otherwise good membership.
  const broken: [string, () => Promise<{ self: SelfCtx; id: string }>][] = [
    ["a forged membership id", async () => ({ self: u, id: "mbr_01K00000000000000000000000" })],
    ["an inactive membership", async () => (await sql("update client_memberships set status = 'revoked' where id = $1", [membershipId]), { self: u, id: membershipId })],
    ["another user's membership", async () => ({ self: other, id: membershipId })],
    ["an archived client", async () => (await clientsRepo.archive(x, clientId), { self: u, id: membershipId })],
    ["a client row bound to someone else", async () => (await sql("update clients set client_user_id = $2 where id = $1", [clientId, other.userId]), { self: u, id: membershipId })],
    ["a client row bound to no one", async () => (await sql("update clients set client_user_id = null where id = $1", [clientId]), { self: u, id: membershipId })],
    [
      "a membership naming a clinician who does not own the client",
      async () => {
        const y = await createTestUser("clinician", "y@example.test");
        await sql("update client_memberships set clinician_user_id = $2 where id = $1", [membershipId, y.userId]);
        return { self: u, id: membershipId };
      },
    ],
  ];

  it("builds a ClientCtx for the tenant from a good membership", async () => {
    await expect(clientCtxFor(u, membershipId)).resolves.toEqual({ scope: "client", userId: x.userId, clientId, actorId: u.userId });
  });

  it.each(broken)("throws NotOwnedError for %s", async (_name, arrange) => {
    const { self, id } = await arrange();
    await expect(clientCtxFor(self, id)).rejects.toBeInstanceOf(NotOwnedError);
  });

  it("refuses a context that is not a signed-in client's own", async () => {
    await expect(clientCtxFor(x as never, membershipId)).rejects.toThrow();
  });

  describe("GET /api/v1/memberships/[id]", () => {
    it("serves the client's own record through a good membership", async () => {
      request.headers = await signedInHeaders("u@example.test");
      const response = await get(membershipId);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ membershipId, firstName: "Ana" });
    });

    it.each(broken)("answers 404 for %s", async (_name, arrange) => {
      const { self, id } = await arrange();
      request.headers = await signedInHeaders(self === u ? "u@example.test" : "other@example.test");
      const response = await get(id);
      expect(response.status).toBe(404);
      expect(JSON.stringify(await response.json())).not.toContain("Ana");
    });

    it("answers 401 signed out and 404 to a clinician", async () => {
      expect((await get(membershipId)).status).toBe(401);
      request.headers = await signedInHeaders("x@example.test");
      expect((await get(membershipId)).status).toBe(404);
    });
  });
});
