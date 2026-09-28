import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING } from "@/core/copy/onboarding";
import type { ClinicianCtx } from "@/server/auth/ctx";
import { INTENT_COOKIE, signIntent } from "@/server/auth/intent";
import { pool } from "@/server/db";
import { clinicianProfilesRepo, NpiTaken } from "@/server/db/repos/clinician-profiles";
import { resolvers } from "@/server/db/repos/resolvers";
import { createTestUser, decryptedDump, resetDb, signedInHeaders } from "@/server/db/testing";
import { LegalPlaceholder, liveText } from "@/server/legal";
import { tempLegalDir } from "@/test-support/legal-dir";
import {
  authorizeFiling,
  completeClinicianSignup,
  completeOnboarding,
  onboardingStep,
  ProfileRefused,
  profileForClaims,
  profileView,
  saveProfile,
  setFees,
  SignupRefused,
  startClinicianSignup,
} from "./clinician";

const request = vi.hoisted(() => ({ headers: new Headers(), cookies: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    get: (name: string) => (request.cookies.has(name) ? { name, value: request.cookies.get(name) } : undefined),
    set: (name: string, value: string) => void request.cookies.set(name, value),
    delete: (name: string) => void request.cookies.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

const IP = "198.51.100.23";
const UA = "Mozilla/5.0 Ferry-Clinician-Test/1.0";
const roleOf = async (userId: string) => (await pool.query<{ role: string }>("select role from users where id = $1", [userId])).rows[0].role;
const agreement = async (typedName = "Rachel Steinberg") => ({ typedName, shown: { terms: (await liveText("terms")).hash, baa: (await liveText("baa")).hash }, ip: IP, userAgent: UA });

export const PRACTICE = {
  legalName: "Rachel Steinberg",
  credential: "LCSW",
  npi: "1999000023",
  npiType: "individual",
  groupName: "",
  groupNpi: "",
  taxIdType: "SSN",
  taxId: "900-11-4242",
  address: { line1: "2 Practice St", line2: "", city: "Oakland", state: "CA", zip: "94610" },
  licenseState: "CA",
  licenseNumber: "LCS 88213",
  taxonomyCode: "1041C0700X",
  defaultNoteFormat: "dap",
  defaultModality: "in_person",
};

async function signIn(role: "pending" | "client" | "clinician", email: string) {
  const user = await createTestUser(role, email);
  request.headers = await signedInHeaders(email);
  return user;
}

async function onboarded(email: string, npi = PRACTICE.npi): Promise<ClinicianCtx> {
  const user = await signIn("pending", email);
  const ctx = await completeClinicianSignup(signIntent(email), await agreement());
  expect(ctx.userId).toBe(user.userId);
  await saveProfile(ctx, { ...PRACTICE, npi });
  await setFees(ctx, [{ cptCode: "90837", amount: "175" }]);
  await authorizeFiling(ctx, { typedName: "Rachel Steinberg", shownHash: (await liveText("npi_filing_authorization")).hash, ip: IP, userAgent: UA });
  await completeOnboarding(ctx);
  return ctx;
}

afterAll(() => pool.end());

describe("clinician sign-up", () => {
  beforeEach(async () => {
    await resetDb();
    request.headers = new Headers();
    request.cookies.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("the role becomes clinician only from the signed intent", async () => {
    const { userId } = await signIn("pending", "rachel@example.test");
    const ctx = await completeClinicianSignup(signIntent("RACHEL@example.test"), await agreement());
    expect(ctx).toEqual({ scope: "clinician", userId });
    expect(await roleOf(userId)).toBe("clinician");
  });

  it("a role in the body, a tampered cookie, or an existing client visiting /start leaves the role unchanged", async () => {
    const { agreeToTerms } = await import("@/app/app/welcome/actions");
    const pending = await signIn("pending", "maybe@example.test");
    const form = async (extra: Record<string, string>) => {
      const fd = new FormData();
      const a = await agreement();
      for (const [k, v] of Object.entries({ typedName: a.typedName, terms: a.shown.terms, baa: a.shown.baa, ...extra })) fd.set(k, v);
      return fd;
    };

    // A role in the body, with no intent cookie.
    for (const role of ["clinician", "staff", "client"]) {
      await expect(agreeToTerms(await form({ role }))).rejects.toThrow("redirect:/app/welcome?problem=no_intent");
      expect(await roleOf(pending.userId)).toBe("pending");
    }

    // Tampered, expired, or made for another email.
    const good = signIntent("maybe@example.test");
    const [body, mac] = good.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), exp: 9_999_999_999 })).toString("base64url");
    const flipped = mac.slice(0, -1) + (mac.at(-1) === "A" ? "B" : "A");
    const tampered = [`${forged}.${mac}`, `${body}.${flipped}`, `${body}.`, body, "clinician", signIntent("maybe@example.test", new Date(Date.now() - 2 * 3_600_000)), signIntent("someone-else@example.test")];
    for (const cookie of tampered) {
      request.cookies.set(INTENT_COOKIE, cookie);
      await expect(agreeToTerms(await form({ role: "clinician" }))).rejects.toThrow("redirect:/app/welcome?problem=no_intent");
      await expect(completeClinicianSignup(cookie, await agreement())).rejects.toThrow(SignupRefused);
      expect(await roleOf(pending.userId)).toBe("pending");
    }

    // A valid intent with role=staff in the body makes a clinician, never staff, and the cookie is spent.
    request.cookies.set(INTENT_COOKIE, good);
    await expect(agreeToTerms(await form({ role: "staff" }))).rejects.toThrow("redirect:/app/welcome");
    expect(await roleOf(pending.userId)).toBe("clinician");
    expect(request.cookies.has(INTENT_COOKIE)).toBe(false);

    // An existing client goes through Start free with their own email: the link goes out, the role does not change.
    const client = await signIn("client", "client@example.test");
    const started = await startClinicianSignup("client@example.test", new Headers());
    expect(started.kind).toBe("sent");
    const intent = started.kind === "sent" ? started.intent : "";
    await expect(completeClinicianSignup(intent, await agreement())).rejects.toMatchObject({ name: "SignupRefused", reason: "other_role" });
    expect(await roleOf(client.userId)).toBe("client");
    expect(ONBOARDING.problems.other_role).toMatch(/already has a client account/);
  });

  it("refuses a missing name or a text that changed since it was shown, leaving the user pending", async () => {
    const { userId } = await signIn("pending", "rachel@example.test");
    await expect(completeClinicianSignup(signIntent("rachel@example.test"), await agreement("  "))).rejects.toMatchObject({ reason: "no_name" });
    const stale = await agreement();
    await expect(completeClinicianSignup(signIntent("rachel@example.test"), { ...stale, shown: { ...stale.shown, baa: "0".repeat(64) } })).rejects.toMatchObject({ reason: "text_changed" });
    expect(await roleOf(userId)).toBe("pending");
  });

  it("terms and BAA are stored with version and hash at sign-up", async () => {
    const { userId } = await signIn("pending", "rachel@example.test");
    await completeClinicianSignup(signIntent("rachel@example.test"), await agreement());
    const { rows } = await pool.query("select doc_type, version, content_hash, typed_name, ip, user_agent, withdrawn_at from clinician_consents where user_id = $1 order by doc_type", [userId]);
    expect(rows.map((r) => [r.doc_type, r.version, r.content_hash, r.withdrawn_at])).toEqual([
      ["baa", "0.0.0", (await liveText("baa")).hash, null],
      ["terms", "0.0.0", (await liveText("terms")).hash, null],
    ]);
    for (const r of rows) for (const v of [r.typed_name, r.ip, r.user_agent]) expect(v).toMatch(/^v1\./);
    const readable = await decryptedDump(userId);
    for (const v of ["Rachel Steinberg", IP, UA]) expect(readable).toContain(v);
    expect(await onboardingStep({ scope: "clinician", userId } as ClinicianCtx)).toBe("practice");
  });

  it("in the prod tier, onboarding refuses while terms or BAA are placeholders", async () => {
    const ctx = await onboarded("done@example.test");
    const { userId } = await signIn("pending", "rachel@example.test");
    const shown = await agreement();

    vi.stubEnv("FERRY_DEPLOY_TIER", "prod");
    vi.stubEnv("FERRY_OPEN_SIGNUP", "1");
    // Outside the dev tier FERRY_LEGAL_DIR is ignored, so these are the repo's texts, still placeholders (F4).
    const legal = tempLegalDir();
    legal.setPlaceholder("terms", false);
    legal.setPlaceholder("baa", false);
    try {
      await expect(completeClinicianSignup(signIntent("rachel@example.test"), shown)).rejects.toBeInstanceOf(LegalPlaceholder);
      expect(await roleOf(userId)).toBe("pending");

      await pool.query("update clinician_profiles set onboarded_at = null where user_id = $1", [ctx.userId]);
      await expect(completeOnboarding(ctx)).rejects.toMatchObject({ name: "LegalPlaceholder", docTypes: ["terms", "baa"] });
      expect((await clinicianProfilesRepo.get(ctx))?.onboardedAt).toBeNull();
    } finally {
      legal.restore();
    }

    vi.unstubAllEnvs();
    await completeOnboarding(ctx);
    expect((await clinicianProfilesRepo.get(ctx))?.onboardedAt).toBeInstanceOf(Date);
  });
});

describe("clinician profile", () => {
  let x: ClinicianCtx;

  beforeEach(async () => {
    await resetDb();
    request.cookies.clear();
    x = await createTestUser("clinician", "x@example.test");
  });
  afterEach(() => vi.restoreAllMocks());

  it("a second profile with an NPI already on another tenant is refused with plain copy; a bad NPI check digit is rejected before any lookup", async () => {
    await saveProfile(x, PRACTICE);
    const y = await createTestUser("clinician", "y@example.test");
    const refused = await saveProfile(y, { ...PRACTICE, legalName: "Owen Achebe", taxId: "900-11-5353" }).catch((e) => e);
    expect(refused).toBeInstanceOf(ProfileRefused);
    expect(refused).toMatchObject({ reason: "npi_taken", fields: ["npi"] });
    expect(ONBOARDING.problems[refused.reason as "npi_taken"]).toBe("That NPI is already on another Ferry account. If it's yours, write to us and we'll sort it out.");
    expect(await clinicianProfilesRepo.get(y)).toBeNull();
    // The unique index holds even if two sign-ups race past the lookup.
    await expect(clinicianProfilesRepo.create(y, { ...(await clinicianProfilesRepo.get(x))!, legalName: "Owen Achebe" })).rejects.toBeInstanceOf(NpiTaken);

    const lookup = vi.spyOn(resolvers, "profileOwnerByNpi");
    for (const npi of ["1999000024", "199900002", "2999000023x"]) {
      await expect(saveProfile(y, { ...PRACTICE, npi })).rejects.toMatchObject({ reason: expect.stringMatching(/^npi_(check|format)$/), fields: expect.arrayContaining(["npi"]) });
    }
    expect(lookup).not.toHaveBeenCalled();
    await saveProfile(y, { ...PRACTICE, npi: "1234567893" });
    expect(lookup).toHaveBeenCalledWith("1234567893");
  });

  it("seals the Tax ID with a blind index and last four; the view carries only the last four; a blank Tax ID on an edit keeps it", async () => {
    await saveProfile(x, PRACTICE);
    const { rows } = await pool.query("select tax_id, tax_id_bidx, tax_id_last4, practice_address from clinician_profiles where user_id = $1", [x.userId]);
    expect(rows[0].tax_id).toMatch(/^v1\./);
    expect(rows[0].practice_address).toMatch(/^v1\./);
    expect(rows[0].tax_id_last4).toBe("4242");
    expect(rows[0].tax_id_bidx).toMatch(/^[\w-]{43}$/);

    const view = await profileView(x);
    expect(view).toMatchObject({ taxIdType: "SSN", taxIdLast4: "4242", npi: "1999000023", onboarded: false });
    expect(JSON.stringify(view)).not.toContain("900114242");
    expect(Object.keys(view!)).not.toContain("taxId");

    await saveProfile(x, { ...PRACTICE, taxId: "", credential: "LCSW-C" });
    expect((await clinicianProfilesRepo.get(x))).toMatchObject({ taxId: "900114242", credential: "LCSW-C" });
    await saveProfile(x, { ...PRACTICE, taxId: "900-11-7777" });
    expect((await profileView(x))?.taxIdLast4).toBe("7777");
  });

  it("needs a Tax ID the first time, and an EIN, group name and group NPI to bill as a group", async () => {
    await expect(saveProfile(x, { ...PRACTICE, taxId: "" })).rejects.toMatchObject({ reason: "tax_id_required" });
    await expect(saveProfile(x, { ...PRACTICE, npiType: "group", groupName: "Bayside Counseling", groupNpi: "1234567893" })).rejects.toMatchObject({ reason: "group_needs_ein" });
    await expect(saveProfile(x, { ...PRACTICE, npiType: "group", taxIdType: "EIN", taxId: "00-1000002", groupName: "Bayside", groupNpi: "1234567890" })).rejects.toMatchObject({ reason: "group_npi_check" });
    await saveProfile(x, { ...PRACTICE, npiType: "group", taxIdType: "EIN", taxId: "00-1000002", groupName: "Bayside Counseling", groupNpi: "1234567893" });
    const forClaims = await profileForClaims(x);
    expect(forClaims?.party.billing).toMatchObject({ entity: "organization", npi: "1234567893", taxIdType: "EIN", taxId: "001000002" });
    expect(forClaims?.party.rendering).toMatchObject({ npi: "1999000023", name: "Rachel Steinberg" });
  });

  it("a changed NPI or name clears the NPPES and identity checks", async () => {
    await saveProfile(x, PRACTICE);
    await pool.query("update clinician_profiles set nppes_name_match = true, nppes_checked_at = now(), identity_verified_at = now() where user_id = $1", [x.userId]);
    await saveProfile(x, { ...PRACTICE, credential: "LCSW-C" });
    expect(await clinicianProfilesRepo.get(x)).toMatchObject({ nppesNameMatch: true });
    await saveProfile(x, { ...PRACTICE, legalName: "Rachel S. Steinberg" });
    expect(await clinicianProfilesRepo.get(x)).toMatchObject({ nppesNameMatch: null, nppesCheckedAt: null, identityVerifiedAt: null });
  });

  it("walks the onboarding steps and files live only once NPPES, identity and the authorization text all pass", async () => {
    const legal = tempLegalDir();
    try {
      const ctx = await onboarded("walk@example.test");
      expect(await onboardingStep(ctx)).toBe("done");
      const forClaims = await profileForClaims(ctx);
      expect(forClaims).toMatchObject({ fees: [{ cptCode: "90837", chargeCents: 17500 }], liveFilingAllowed: false });
      await pool.query("update clinician_profiles set nppes_name_match = true, identity_verified_at = now() where user_id = $1", [ctx.userId]);
      expect((await profileForClaims(ctx))?.liveFilingAllowed).toBe(false);
      legal.setPlaceholder("npi_filing_authorization", false);
      expect((await profileForClaims(ctx))?.liveFilingAllowed).toBe(true);
    } finally {
      legal.restore();
    }
  });

  it("won't finish onboarding before the filing authorization is signed", async () => {
    const { userId } = await signIn("pending", "early@example.test");
    const ctx = await completeClinicianSignup(signIntent("early@example.test"), await agreement());
    expect(await onboardingStep(ctx)).toBe("practice");
    await expect(completeOnboarding(ctx)).rejects.toMatchObject({ reason: "incomplete" });
    await saveProfile(ctx, PRACTICE);
    expect(await onboardingStep(ctx)).toBe("fees");
    await setFees(ctx, [{ cptCode: "90834", amount: "150" }]);
    expect(await onboardingStep(ctx)).toBe("authorize");
    await expect(completeOnboarding(ctx)).rejects.toMatchObject({ reason: "incomplete" });
    const { rows } = await pool.query("select onboarded_at from clinician_profiles where user_id = $1", [userId]);
    expect(rows[0].onboarded_at).toBeNull();
  });
});
