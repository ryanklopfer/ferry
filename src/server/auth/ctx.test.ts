import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientCtx, ClinicianCtx, Ctx, InviteCtx, SelfCtx, StaffCtx, SystemCtx } from "@/server/auth/ctx";
import { requireClient, requireClinician, requireStaff } from "@/server/auth/ctx";
import { systemCtx } from "@/server/auth/system-ctx";
import { pool } from "@/server/db";
import { claimsRepo } from "@/server/db/repos/claims";
import { clientsRepo } from "@/server/db/repos/clients";
import { followUpsRepo } from "@/server/db/repos/follow-ups";
import { providersRepo } from "@/server/db/repos/providers";
import { createTestUser, resetDb, signedInHeaders } from "@/server/db/testing";

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

type Repo = typeof claimsRepo;
type MethodsAccepting<C> = { [K in keyof Repo]: C extends Parameters<Repo[K]>[0] ? K : never }[keyof Repo];
type MethodsRefusing<C> = { [K in keyof Repo]: C extends Parameters<Repo[K]>[0] ? never : K }[keyof Repo];
type Holds<T extends true> = T;

// Every claimsRepo method, including ones added later: ClinicianCtx and SystemCtx always; a ClientCtx only on the
// reads (tenantWhere narrows it to its client); InviteCtx, StaffCtx and SelfCtx never.
type ClientReads = "list" | "get" | "lines";
export type RepoRefusesOtherScopes = Holds<[MethodsAccepting<InviteCtx>, MethodsAccepting<StaffCtx>, MethodsAccepting<SelfCtx>] extends [never, never, never] ? true : false>;
export type RepoTakesClientOnReadsOnly = Holds<[MethodsAccepting<ClientCtx>] extends [ClientReads] ? ([ClientReads] extends [MethodsAccepting<ClientCtx>] ? true : false) : false>;
export type RepoAcceptsClinicianAndSystem = Holds<[MethodsRefusing<ClinicianCtx>, MethodsRefusing<SystemCtx>] extends [never, never] ? true : false>;

const client: ClientCtx = { scope: "client", userId: "usr_tenant", clientId: "cli_1", actorId: "usr_client" };
const invite: InviteCtx = { scope: "invite", userId: "usr_tenant", clientId: "cli_1", actorId: "usr_client", linkId: "lnk_1" };
const staff: StaffCtx = { scope: "staff", userId: "usr_staff" };

// Never called: the @ts-expect-error lines are the assertions, checked by `bun run typecheck`.
function wrongScopesDoNotCompile() {
  const line = { serviceDate: "2026-08-04", cptCode: "90834", modifiers: [], description: null, units: 1, charge: 17500, diagnosisPointers: [1], placeOfService: "11" };
  const claim = { planId: "pln_1" };
  for (const ctx of [client, invite, staff]) void ctx;
  void claimsRepo.list(client);
  void claimsRepo.get(client, "clm_1");
  void claimsRepo.lines(client, "clm_1");
  // @ts-expect-error a ClientCtx is not a ClinicianOnlyCtx
  void claimsRepo.create(client, claim, [line]);
  // @ts-expect-error a ClientCtx is not a ClinicianOnlyCtx
  void claimsRepo.update(client, "clm_1", {});
  // @ts-expect-error a ClientCtx is not a ClinicianOnlyCtx
  void claimsRepo.save(client, "clm_1", {}, [line]);
  // @ts-expect-error a ClientCtx is not a ClinicianOnlyCtx
  void claimsRepo.replaceLines(client, "clm_1", [line]);
  // @ts-expect-error a ClientCtx is not a ClinicianOnlyCtx
  void claimsRepo.remove(client, "clm_1");
  // @ts-expect-error an InviteCtx reaches only links, clients.client_user_id and memberships
  void claimsRepo.list(invite);
  // @ts-expect-error an InviteCtx reaches only links, clients.client_user_id and memberships
  void claimsRepo.get(invite, "clm_1");
  // @ts-expect-error an InviteCtx reaches only links, clients.client_user_id and memberships
  void claimsRepo.lines(invite, "clm_1");
  // @ts-expect-error an InviteCtx reaches only links, clients.client_user_id and memberships
  void claimsRepo.create(invite, claim, [line]);
  // @ts-expect-error an InviteCtx reaches only links, clients.client_user_id and memberships
  void claimsRepo.update(invite, "clm_1", {});
  // @ts-expect-error an InviteCtx reaches only links, clients.client_user_id and memberships
  void claimsRepo.save(invite, "clm_1", {}, [line]);
  // @ts-expect-error an InviteCtx reaches only links, clients.client_user_id and memberships
  void claimsRepo.replaceLines(invite, "clm_1", [line]);
  // @ts-expect-error an InviteCtx reaches only links, clients.client_user_id and memberships
  void claimsRepo.remove(invite, "clm_1");
  // @ts-expect-error a StaffCtx reaches no tenant repo
  void claimsRepo.list(staff);
  // @ts-expect-error a StaffCtx reaches no tenant repo
  void claimsRepo.get(staff, "clm_1");
  // @ts-expect-error a StaffCtx reaches no tenant repo
  void claimsRepo.lines(staff, "clm_1");
  // @ts-expect-error a StaffCtx reaches no tenant repo
  void claimsRepo.create(staff, claim, [line]);
  // @ts-expect-error a StaffCtx reaches no tenant repo
  void claimsRepo.update(staff, "clm_1", {});
  // @ts-expect-error a StaffCtx reaches no tenant repo
  void claimsRepo.save(staff, "clm_1", {}, [line]);
  // @ts-expect-error a StaffCtx reaches no tenant repo
  void claimsRepo.replaceLines(staff, "clm_1", [line]);
  // @ts-expect-error a StaffCtx reaches no tenant repo
  void claimsRepo.remove(staff, "clm_1");
  // @ts-expect-error follow-ups are clinician-only
  void followUpsRepo.open(client);
  // @ts-expect-error providers are clinician-only
  void providersRepo.list(client);
  // @ts-expect-error clients are created by their clinician
  void clientsRepo.create(client, { firstName: "A", lastName: "B", dob: null, email: null, phone: null });
  // @ts-expect-error a plain object with no scope is not a context
  void claimsRepo.list({ userId: "usr_tenant" });
}

function scopeDetail(ctx: Ctx | SelfCtx | StaffCtx | InviteCtx): string {
  switch (ctx.scope) {
    case "clinician":
      // @ts-expect-error a ClinicianCtx has no clientId
      void ctx.clientId;
      return `clinician ${ctx.userId}`;
    case "client":
      return `client ${ctx.clientId} of ${ctx.userId} as ${ctx.actorId}`;
    case "system":
      return `system ${ctx.job} for ${ctx.userId}`;
    case "invite":
      return `invite ${ctx.linkId}`;
    case "self":
      return `self ${ctx.userId}`;
    case "staff":
      return `staff ${ctx.userId}`;
    default: {
      const unreachable: never = ctx;
      return unreachable;
    }
  }
}

describe("contexts", () => {
  it("keep other scopes out of claimsRepo writes and clinician-only repos at compile time", () => {
    expect(wrongScopesDoNotCompile).toBeTypeOf("function");
  });

  it("narrow on scope", () => {
    expect(scopeDetail(client)).toBe("client cli_1 of usr_tenant as usr_client");
    expect(scopeDetail(systemCtx("usr_tenant", "timers.tick"))).toBe("system timers.tick for usr_tenant");
    expect(scopeDetail(staff)).toBe("staff usr_staff");
  });

  it("builds a SystemCtx for a tenant and a job", () => {
    expect(systemCtx("usr_tenant", "timers.tick")).toEqual({ scope: "system", userId: "usr_tenant", job: "timers.tick" });
  });
});

describe("role guards", () => {
  beforeEach(async () => {
    await resetDb();
    request.headers = new Headers();
  });
  afterAll(() => pool.end());

  async function signInAs(role: "pending" | "clinician" | "client" | "staff") {
    const email = `${role}@example.test`;
    const user = await createTestUser(role, email);
    request.headers = await signedInHeaders(email);
    return user;
  }

  it("send someone who is signed out to sign-in", async () => {
    await expect(requireClinician()).rejects.toThrow("redirect:/sign-in");
    await expect(requireClient()).rejects.toThrow("redirect:/sign-in");
    await expect(requireStaff()).rejects.toThrow("redirect:/sign-in");
  });

  it("give a clinician a ClinicianCtx and nothing else", async () => {
    const user = await signInAs("clinician");
    await expect(requireClinician()).resolves.toEqual({ scope: "clinician", userId: user.userId });
    await expect(requireClient()).rejects.toThrow("notFound");
    await expect(requireStaff()).rejects.toThrow("notFound");
  });

  it("give a client a SelfCtx and nothing else", async () => {
    const user = await signInAs("client");
    await expect(requireClient()).resolves.toEqual({ scope: "self", userId: user.userId });
    await expect(requireClinician()).rejects.toThrow("notFound");
    await expect(requireStaff()).rejects.toThrow("notFound");
  });

  it("give staff a StaffCtx and nothing else", async () => {
    const user = await signInAs("staff");
    await expect(requireStaff()).resolves.toEqual({ scope: "staff", userId: user.userId });
    await expect(requireClinician()).rejects.toThrow("notFound");
    await expect(requireClient()).rejects.toThrow("notFound");
  });

  it("give a pending user no context at all", async () => {
    await signInAs("pending");
    await expect(requireClinician()).rejects.toThrow("notFound");
    await expect(requireClient()).rejects.toThrow("notFound");
    await expect(requireStaff()).rejects.toThrow("notFound");
  });
});
