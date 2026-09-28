import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clientCtxFor } from "@/server/auth/client-ctx";
import type { ClinicianCtx, SelfCtx } from "@/server/auth/ctx";
import { keyProvider } from "@/server/crypto";
import { open, SealError } from "@/server/crypto/aead";
import { tenantKeyring } from "@/server/crypto/tenant-keys";
import { pool } from "@/server/db";
import { plansRepo } from "./repos/plans";
import { bindClientUser, createTestUser, resetDb, seedSyntheticClient } from "./testing";

const A1 = { firstName: "Anneliese", lastName: "Vandermeer", email: "anneliese@example.test", phone: "555-010-0001", dob: "1990-01-01", memberId: "W8841207733", groupNumber: "GRP-1", diagnosis: "F41.1", taxId: "00-1000002" };
const B1 = { ...A1, firstName: "Cordelia", email: "cordelia@example.test", memberId: "H7720045519" };

// Clinicians X and Y; X's client A1; Y's client B1; client user U bound to both.
describe("per-tenant keys", () => {
  let x: ClinicianCtx;
  let y: ClinicianCtx;
  let u: SelfCtx;
  let a1: Awaited<ReturnType<typeof seedSyntheticClient>>;
  let uA1: string;

  beforeEach(async () => {
    await resetDb();
    x = await createTestUser("clinician");
    y = await createTestUser("clinician");
    u = await createTestUser("client");
    a1 = await seedSyntheticClient(x, A1);
    const b1 = await seedSyntheticClient(y, B1);
    uA1 = await bindClientUser(x, a1.client.id, u);
    await bindClientUser(y, b1.client.id, u);
  });
  afterAll(() => pool.end());

  it("gives each clinician tenant its own data and index keys", async () => {
    const [rx, ry] = await Promise.all([tenantKeyring(x.userId), tenantKeyring(y.userId)]);
    expect(rx.data.id).not.toBe(ry.data.id);
    expect(Buffer.compare(rx.data.bytes, ry.data.bytes)).not.toBe(0);
    expect(Buffer.compare(rx.data.bytes, rx.index)).not.toBe(0);
    const { rows } = await pool.query("select user_id from tenant_keys order by user_id");
    expect(rows.map((r) => r.user_id)).toEqual([x.userId, y.userId].sort());
  });

  it("lets ClientCtx(U→X) read A1's plan in plaintext with X's key", async () => {
    const asA1 = await clientCtxFor(u, uA1);
    const plan = await plansRepo.get(asA1, a1.plan.id);
    expect(plan).toMatchObject({ memberId: A1.memberId, subscriberName: "Anneliese Vandermeer", patientEmail: A1.email, patientRelationship: "self" });
  });

  it("does not let Y's tenant key open A1's plan", async () => {
    const { rows } = await pool.query<{ member_id: string; subscriber_name: string }>("select member_id, subscriber_name from plans where id = $1", [a1.plan.id]);
    const stored = rows[0];
    expect(stored.member_id).not.toContain(A1.memberId);
    const ry = await tenantKeyring(y.userId);
    expect(() => open(ry.data, stored.member_id)).toThrow(SealError);
    // Even relabelled as X's key id, Y's key bytes fail authentication.
    const rx = await tenantKeyring(x.userId);
    expect(() => open({ id: rx.data.id, bytes: ry.data.bytes }, stored.member_id)).toThrow(SealError);
    expect(JSON.parse(open(rx.data, stored.member_id))).toBe(A1.memberId);
  });

  it("keeps a wrapped tenant key bound to its tenant", async () => {
    const { rows } = await pool.query<{ user_id: string; kek_ref: string; wrapped_key: string }>("select user_id, kek_ref, wrapped_key from tenant_keys where user_id = $1", [x.userId]);
    await expect(keyProvider().unwrap({ kekRef: rows[0].kek_ref, wrapped: rows[0].wrapped_key }, { tenantId: y.userId })).rejects.toThrow();
  });
});
