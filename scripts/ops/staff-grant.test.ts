import { spawnSync } from "node:child_process";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, pool, schema } from "@/server/db";
import { createTestUser, resetDb } from "@/server/db/testing";
import { staffGrant } from "./staff-grant";

const roleOf = async (email: string) => (await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.email, email)))[0]?.role;

describe("staff:grant", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("makes an existing pending user staff", async () => {
    await createTestUser("pending", "ops@example.test");
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await staffGrant(["ops@example.test"])).toBe(0);
    expect(await roleOf("ops@example.test")).toBe("staff");
    expect(out).toHaveBeenCalled();
    out.mockRestore();
  });

  it("matches the email regardless of case and surrounding space", async () => {
    await createTestUser("pending", "ops@example.test");
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await staffGrant(["  OPS@Example.test "])).toBe(0);
    expect(await roleOf("ops@example.test")).toBe("staff");
    vi.restoreAllMocks();
  });

  it("refuses an email no one has signed up with, and changes nothing", async () => {
    await createTestUser("pending", "ops@example.test");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await staffGrant(["nobody@example.test"])).toBe(1);
    expect(err.mock.calls.flat().join(" ")).toMatch(/no user/i);
    expect(await roleOf("ops@example.test")).toBe("pending");
    expect(await db.select().from(schema.users)).toHaveLength(1);
    err.mockRestore();
  });

  it("refuses a clinician or a client, since a user has one role at launch", async () => {
    await createTestUser("clinician", "dr@example.test");
    await createTestUser("client", "cl@example.test");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await staffGrant(["dr@example.test"])).toBe(1);
    expect(await staffGrant(["cl@example.test"])).toBe(1);
    expect(await roleOf("dr@example.test")).toBe("clinician");
    expect(await roleOf("cl@example.test")).toBe("client");
    err.mockRestore();
  });

  it("is a no-op for someone who is already staff", async () => {
    await createTestUser("staff", "ops@example.test");
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await staffGrant(["ops@example.test"])).toBe(0);
    expect(await roleOf("ops@example.test")).toBe("staff");
    vi.restoreAllMocks();
  });

  it("needs exactly one email argument", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await staffGrant([])).toBe(1);
    expect(await staffGrant(["a@example.test", "b@example.test"])).toBe(1);
    err.mockRestore();
  });

  it("runs as `bun run staff:grant <email>`", async () => {
    await createTestUser("pending", "cli@example.test");
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: "postgres://localhost:5432/ferry_test" };
    delete env.VITEST;
    const run = (email: string) => spawnSync("bun", ["run", "staff:grant", email], { cwd: path.join(__dirname, "..", ".."), env, encoding: "utf8", timeout: 20_000 });
    const unknown = run("missing@example.test");
    expect(unknown.status).toBe(1);
    const ok = run("cli@example.test");
    expect(ok.status, ok.stderr).toBe(0);
    expect(await roleOf("cli@example.test")).toBe("staff");
  });
});
