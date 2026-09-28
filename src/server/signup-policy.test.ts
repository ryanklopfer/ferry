import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { JOIN_BETA } from "@/core/copy/home";
import { ONBOARDING } from "@/core/copy/onboarding";
import { INTENT_COOKIE } from "@/server/auth/intent";
import { pool } from "@/server/db";
import { resetDb } from "@/server/db/testing";
import { sentInThisProcess } from "@/server/integrations/email";
import { signupPolicy } from "./signup";

const request = vi.hoisted(() => ({ cookies: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: (name: string, value: string) => void request.cookies.set(name, value), get: () => undefined, delete: () => undefined }),
}));

const prod = { FERRY_DEPLOY_TIER: "prod", BETA_ALLOWLIST: "dr.ana@example.test, Owen.Achebe@Example.test\nthird@example.test" };

describe("signupPolicy", () => {
  it("in the prod tier an email not on BETA_ALLOWLIST is refused with plain copy until FERRY_OPEN_SIGNUP=1", () => {
    const refused = signupPolicy("stranger@example.test", prod);
    expect(refused).toEqual({ kind: "refused", message: ONBOARDING.signup.betaOnly });
    expect(ONBOARDING.signup.betaOnly).toBe("Ferry is letting clinicians in a few at a time during the beta. We'll email you as soon as there's room.");
    expect(ONBOARDING.signup.betaOnly).not.toMatch(/allow|list|tier|prod|env|error|denied|invalid/i);

    for (const email of ["dr.ana@example.test", "owen.achebe@example.test", " THIRD@example.test "]) expect(signupPolicy(email, prod), email).toEqual({ kind: "open" });
    expect(signupPolicy("stranger@example.test", { ...prod, BETA_ALLOWLIST: "" }).kind).toBe("refused");
    expect(signupPolicy("stranger@example.test", { FERRY_DEPLOY_TIER: "prod" }).kind).toBe("refused");
    expect(signupPolicy("stranger@example.test", { ...prod, FERRY_OPEN_SIGNUP: "true" }).kind).toBe("refused");
    expect(signupPolicy("stranger@example.test", { ...prod, FERRY_OPEN_SIGNUP: "1" })).toEqual({ kind: "open" });
  });

  it("is open in dev and staging, and a mailto in prelaunch", () => {
    for (const tier of ["dev", "staging"]) expect(signupPolicy("stranger@example.test", { FERRY_DEPLOY_TIER: tier })).toEqual({ kind: "open" });
    expect(signupPolicy("dr.ana@example.test", { FERRY_DEPLOY_TIER: "prelaunch", BETA_ALLOWLIST: "dr.ana@example.test" })).toEqual({ kind: "mailto", href: JOIN_BETA.href });
    expect(signupPolicy("dr.ana@example.test", { ...prod, FERRY_OPEN_SIGNUP: "1", FERRY_PRELAUNCH: "1" })).toEqual({ kind: "mailto", href: JOIN_BETA.href });
  });
});

describe("Start free under the policy", () => {
  beforeEach(async () => {
    await resetDb();
    request.cookies.clear();
    sentInThisProcess.length = 0;
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    return pool.end();
  });

  it("sends no link and sets no intent for a refused email, and does both for an admitted one (dev tier, where the fixture mailer may run)", async () => {
    const { startClinicianSignupAction } = await import("@/app/(public)/start/actions");
    for (const [k, v] of Object.entries({ ...prod, FERRY_OPEN_SIGNUP: "" })) vi.stubEnv(k, v);
    const email = (to: string) => {
      const fd = new FormData();
      fd.set("email", to);
      fd.set("role", "clinician");
      return fd;
    };

    expect(await startClinicianSignupAction({ kind: "idle" }, email("stranger@example.test"))).toEqual({ kind: "refused", message: ONBOARDING.signup.betaOnly });
    expect(sentInThisProcess).toEqual([]);
    expect(request.cookies.size).toBe(0);

    vi.unstubAllEnvs();
    expect(await startClinicianSignupAction({ kind: "idle" }, email("dr.ana@example.test"))).toEqual({ kind: "sent", to: "dr.ana@example.test" });
    expect(sentInThisProcess.map((m) => m.to)).toEqual(["dr.ana@example.test"]);
    expect(new URL(sentInThisProcess[0].signInLink!).searchParams.get("callbackURL")).toBe("/app/welcome");
    expect([...request.cookies.keys()]).toEqual([INTENT_COOKIE]);
  });
});
