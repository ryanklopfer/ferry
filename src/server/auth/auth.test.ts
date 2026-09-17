import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth, MAGIC_LINK_TTL_SECONDS } from "@/server/auth";
import { ctxFromHeaders } from "@/server/auth/ctx";
import { db, pool, schema } from "@/server/db";
import { resetDb } from "@/server/db/testing";
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

  it("creates a verified patient and a session when the link is opened", async () => {
    const { url } = await requestLink();
    const { headers, location } = await openLink(url);
    const ctx = await ctxFromHeaders(headers);
    expect(location).toBe("http://localhost:3000/");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, ADDRESS));
    expect(user.emailVerified).toBe(true);
    expect(user.role).toBe("patient");
    expect(ctx).toEqual({ userId: user.id, role: "patient" });
  });

  it("does not sign anyone in when the same link is opened twice", async () => {
    const { url } = await requestLink();
    await openLink(url);
    const second = await openLink(url);
    expect(second.location).toContain("error=INVALID_TOKEN");
    expect(await ctxFromHeaders(second.headers)).toBeNull();
  });

  it("still works 14 minutes after it was sent", async () => {
    const { url } = await requestLink();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 14 * 60 * 1000);
    const { headers } = await openLink(url);
    expect(await ctxFromHeaders(headers)).not.toBeNull();
  });

  it("does not sign anyone in once the link is older than 15 minutes", async () => {
    expect(MAGIC_LINK_TTL_SECONDS).toBe(900);
    const { url } = await requestLink();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    const { headers, location } = await openLink(url);
    expect(location).toContain("error=");
    expect(await ctxFromHeaders(headers)).toBeNull();
  });

  it("has no context without a cookie or with a made-up one", async () => {
    expect(await ctxFromHeaders(new Headers())).toBeNull();
    expect(await ctxFromHeaders(new Headers({ cookie: "better-auth.session_token=not-a-real-token" }))).toBeNull();
  });

  it("denies a session whose stored role is not one we know", async () => {
    const { url } = await requestLink();
    const { headers } = await openLink(url);
    expect(await ctxFromHeaders(headers)).not.toBeNull();
    await db.update(schema.users).set({ role: "superuser" }).where(eq(schema.users.email, ADDRESS));
    expect(await ctxFromHeaders(headers)).toBeNull();
  });

  it("ignores a role supplied by the person signing up", async () => {
    sentInThisProcess.length = 0;
    await auth.api.signInMagicLink({ body: { email: ADDRESS, callbackURL: "/", role: "staff" } as never, headers: new Headers() });
    const url = new URL(sentInThisProcess[0].text.match(/https?:\/\/\S+/)![0]);
    await openLink(url);
    const users = await db.select().from(schema.users);
    expect(users.map((u) => u.role)).toEqual(["patient"]);
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
