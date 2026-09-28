import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinicianCtx } from "@/server/auth/ctx";
import { pool } from "@/server/db";
import { clientsRepo } from "./repos/clients";
import { plansRepo } from "./repos/plans";
import { createTestUser, resetDb, seedSyntheticClient, type SyntheticPerson } from "./testing";

// Every decryption goes through aead.open; counting its calls proves a lookup decrypted nothing.
const opens = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/server/crypto/aead", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/crypto/aead")>();
  return {
    ...real,
    open: (...args: Parameters<typeof real.open>) => {
      opens.count++;
      return real.open(...args);
    },
  };
});

const person = (firstName: string, email: string, memberId: string): SyntheticPerson => ({ firstName, lastName: "Vandermeer", email, phone: "555-010-0000", dob: "1990-01-01", memberId, groupNumber: "GRP-1", diagnosis: "F41.1", taxId: "00-1000002" });

describe("blind-index lookups", () => {
  let x: ClinicianCtx;
  let y: ClinicianCtx;
  let a1: Awaited<ReturnType<typeof seedSyntheticClient>>;
  let a2: Awaited<ReturnType<typeof seedSyntheticClient>>;

  beforeEach(async () => {
    await resetDb();
    x = await createTestUser("clinician");
    y = await createTestUser("clinician");
    a1 = await seedSyntheticClient(x, person("Anneliese", "anneliese@example.test", "W8841207733"));
    a2 = await seedSyntheticClient(x, person("Bartholomew", "bartholomew@example.test", "U5530981264"));
    await seedSyntheticClient(y, person("Anneliese", "anneliese@example.test", "W8841207733"));
    // The open count is taken after the keyring and seed exist, so only the lookups are measured.
    await clientsRepo.idsByEmail(x, "warmup@example.test");
    opens.count = 0;
  });
  afterAll(() => pool.end());

  it("finds a plan by member ID without decrypting any row", async () => {
    expect(await plansRepo.idsByMemberId(x, "W8841207733")).toEqual([a1.plan.id]);
    expect(await plansRepo.idsByMemberId(x, " w884-120-7733 ")).toEqual([a1.plan.id]);
    expect(await plansRepo.idsByMemberId(x, "U5530981264")).toEqual([a2.plan.id]);
    expect(await plansRepo.idsByMemberId(x, "W0000000000")).toEqual([]);
    expect(opens.count).toBe(0);
  });

  it("finds a client by email without decrypting any row", async () => {
    expect(await clientsRepo.idsByEmail(x, "anneliese@example.test")).toEqual([a1.client.id]);
    expect(await clientsRepo.idsByEmail(x, " Anneliese@Example.TEST")).toEqual([a1.client.id]);
    expect(await clientsRepo.idsByEmail(x, "nobody@example.test")).toEqual([]);
    expect(opens.count).toBe(0);
  });

  it("stays inside the tenant: the same email or member ID under Y is a different index value", async () => {
    const [yClient] = await clientsRepo.idsByEmail(y, "anneliese@example.test");
    expect(yClient).toBeDefined();
    expect(yClient).not.toBe(a1.client.id);
    const { rows } = await pool.query<{ user_id: string; email_bidx: string }>("select user_id, email_bidx from clients where id = any($1)", [[a1.client.id, yClient]]);
    expect(new Set(rows.map((r) => r.email_bidx)).size).toBe(2);
    expect(opens.count).toBe(0);
  });

  it("decrypts only when a row is actually read", async () => {
    const [id] = await clientsRepo.idsByEmail(x, "bartholomew@example.test");
    expect((await clientsRepo.get(x, id))?.firstName).toBe("Bartholomew");
    expect(opens.count).toBeGreaterThan(0);
  });
});
