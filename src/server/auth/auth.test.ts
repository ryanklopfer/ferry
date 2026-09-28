import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth, MAGIC_LINK_TTL_SECONDS } from "@/server/auth";
import { sessionFromHeaders } from "@/server/auth/ctx";
import { db, pool, schema } from "@/server/db";
import { createTestUser, resetDb } from "@/server/db/testing";
import { sentInThisProcess } from "@/server/integrations/email";

const ADDRESS = "samira.haddad@example.test";

async function requestLink(address = ADDRESS) {
  sentInThisProcess.length = 0;
  await auth.api.signInMagicLink({ body: { email: address, callbackURL: "/" }, headers: new Headers() });
  const message = sentInThisProcess[0];
  const url = new URL(message.text.match(/https?:\/\/\S+/)![0]);
  return { message, url };
}

async function openLink(url: URL): Promise<{ headers: Headers; location: string | null }> {
  const query = Object.fromEntries(url.searchParams) as { token: string; callbackURL?: string };
  const response = await auth.api.magicLinkVerify({ query, headers: new Headers(), asResponse: true });
  const cookie = response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { headers: new Headers(cookie ? { cookie } : {}), location: response.headers.get("location") };
}

describe("magic link sign-in", () => {
  beforeEach(resetDb);
  afterEach(() => vi.useRealTimers());
  afterAll(() => pool.end());

  it("sends one email to the address with a verify link", async () => {
    const { message, url } = await requestLink();
    expect(sentInThisProcess).toHaveLength(1);
    expect(message.to).toBe(ADDRESS);
    expect(message.subject).toBe("Your Ferry sign-in link");
    expect(url.pathname).toBe("/api/auth/magic-link/verify");
    expect(url.searchParams.get("token")).toBeTruthy();
  });

  it("stores the token hashed, never in the clear", async () => {
    const { url } = await requestLink();
    const rows = await db.select().from(schema.verifications);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toContain(url.searchParams.get("token")!);
  });

  it("creates a verified pending user and a session when the link is opened", async () => {
    const { url } = await requestLink();
    const { headers, location } = await openLink(url);
    const session = await sessionFromHeaders(headers);
    expect(location).toBe("http://localhost:3000/");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, ADDRESS));
    expect(user.emailVerified).toBe(true);
    expect(user.role).toBe("pending");
    expect(session).toEqual({ userId: user.id, role: "pending" });
  });

  it("never stores a name, whatever the sign-in or update-user request sends", async () => {
    sentInThisProcess.length = 0;
    await auth.api.signInMagicLink({ body: { email: ADDRESS, name: "Samira Haddad", callbackURL: "/" }, headers: new Headers() });
    const { headers } = await openLink(new URL(sentInThisProcess[0].text.match(/https?:\/\/\S+/)![0]));
    const nameOf = async () => (await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.email, ADDRESS)))[0].name;
    expect(await nameOf()).toBe("");
    await auth.api.updateUser({ body: { name: "Samira Haddad" }, headers });
    expect(await nameOf()).toBe("");
  });

  it("does not sign anyone in when the same link is opened twice", async () => {
    const { url } = await requestLink();
    await openLink(url);
    const second = await openLink(url);
    expect(second.location).toContain("error=INVALID_TOKEN");
    expect(await sessionFromHeaders(second.headers)).toBeNull();
  });

  it("still works 14 minutes after it was sent", async () => {
    const { url } = await requestLink();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 14 * 60 * 1000);
    const { headers } = await openLink(url);
    expect(await sessionFromHeaders(headers)).not.toBeNull();
  });

  it("does not sign anyone in once the link is older than 15 minutes", async () => {
    expect(MAGIC_LINK_TTL_SECONDS).toBe(900);
    const { url } = await requestLink();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    const { headers, location } = await openLink(url);
    expect(location).toContain("error=");
    expect(await sessionFromHeaders(headers)).toBeNull();
  });

  it("has no context without a cookie or with a made-up one", async () => {
    expect(await sessionFromHeaders(new Headers())).toBeNull();
    expect(await sessionFromHeaders(new Headers({ cookie: "better-auth.session_token=not-a-real-token" }))).toBeNull();
  });

  it("denies a session whose stored role is not one we know", async () => {
    const { url } = await requestLink();
    const { headers } = await openLink(url);
    expect(await sessionFromHeaders(headers)).not.toBeNull();
    for (const role of ["superuser", "patient", "provider", "Clinician", ""]) {
      await db.update(schema.users).set({ role }).where(eq(schema.users.email, ADDRESS));
      expect(await sessionFromHeaders(headers), role).toBeNull();
    }
  });

  it("ignores a role supplied by the person signing up", async () => {
    for (const role of ["staff", "clinician", "client"]) {
      await resetDb();
      sentInThisProcess.length = 0;
      await auth.api.signInMagicLink({ body: { email: ADDRESS, callbackURL: "/", role } as never, headers: new Headers() });
      const url = new URL(sentInThisProcess[0].text.match(/https?:\/\/\S+/)![0]);
      await openLink(url);
      const users = await db.select().from(schema.users);
      expect(users.map((u) => u.role), role).toEqual(["pending"]);
    }
  });

  it("refuses a signed-in user who tries to set their own role", async () => {
    const { url } = await requestLink();
    const { headers } = await openLink(url);
    for (const role of ["clinician", "staff", "client"]) {
      await expect(auth.api.updateUser({ body: { role } as never, headers }), role).rejects.toThrow();
      const response = await auth.handler(new Request("http://localhost:3000/api/auth/update-user", { method: "POST", headers: { cookie: headers.get("cookie")!, "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ role }) }));
      expect(response.status, role).toBeGreaterThanOrEqual(400);
    }
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, ADDRESS));
    expect(user.role).toBe("pending");
    expect((await sessionFromHeaders(headers))?.role).toBe("pending");
  });

  it("keeps the role of an existing user who signs in again", async () => {
    await createTestUser("clinician", ADDRESS);
    const { url } = await requestLink();
    const { headers } = await openLink(url);
    expect((await sessionFromHeaders(headers))?.role).toBe("clinician");
  });

  it("offers passkey registration for this site to a signed-in person", async () => {
    const { url } = await requestLink();
    const { headers } = await openLink(url);
    const options = await auth.api.generatePasskeyRegistrationOptions({ headers });
    expect(options.rp).toEqual({ id: "localhost", name: "Ferry" });
  });

  it("refuses passkey registration to someone who is not signed in", async () => {
    await expect(auth.api.generatePasskeyRegistrationOptions({ headers: new Headers() })).rejects.toThrow();
  });
});
