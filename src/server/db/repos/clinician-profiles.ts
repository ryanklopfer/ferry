import { and, eq } from "drizzle-orm";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { keyringFor } from "./tenant-keys";
import { db } from "../index";
import { decodeRow, encodeRow } from "../codec";
import { newId } from "../ids";
import { type ClinicianProfile, clinicianProfiles } from "../schema";
import { assertNotClient, tenantWhere } from "./scope";

type Insert = typeof clinicianProfiles.$inferInsert;
export type ProfileValues = Omit<Insert, "id" | "userId" | "createdAt" | "updatedAt" | "taxIdBidx" | "taxIdLast4" | "nppesCheckedAt" | "nppesNameMatch" | "identityVerifiedAt" | "onboardedAt">;
// An edit may leave the Tax ID out, which keeps the one on file. A changed NPI or name clears the S6 checks.
export type ProfilePatch = Omit<ProfileValues, "taxId"> & { taxId?: string; nppesCheckedAt?: null; nppesNameMatch?: null; identityVerifiedAt?: null };

export class NpiTaken extends Error {
  constructor() {
    super("That NPI belongs to another profile");
    this.name = "NpiTaken";
  }
}

const isNpiConflict = (e: unknown) => {
  const cause = (e as { cause?: { code?: string; constraint?: string } })?.cause ?? (e as { code?: string; constraint?: string });
  return cause?.code === "23505" && cause.constraint === "clinician_profiles_npi_idx";
};

// Clinician-only: typed ClinicianOnlyCtx and refusing a ClientCtx at run time. One row per clinician.
export const clinicianProfilesRepo = {
  async get(ctx: ClinicianOnlyCtx): Promise<ClinicianProfile | null> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    const [row] = await db.select().from(clinicianProfiles).where(tenantWhere(clinicianProfiles, ctx));
    return row ? decodeRow(clinicianProfiles, ring, row) : null;
  },

  async create(ctx: ClinicianOnlyCtx, values: ProfileValues): Promise<ClinicianProfile> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    try {
      const [row] = await db.insert(clinicianProfiles).values(encodeRow(clinicianProfiles, ring, { ...values, id: newId("prf"), userId: ctx.userId }, { insert: true })).returning();
      return decodeRow(clinicianProfiles, ring, row);
    } catch (e) {
      if (isNpiConflict(e)) throw new NpiTaken();
      throw e;
    }
  },

  async update(ctx: ClinicianOnlyCtx, id: string, patch: ProfilePatch): Promise<ClinicianProfile | null> {
    assertNotClient(ctx);
    const ring = await keyringFor(ctx);
    try {
      const [row] = await db
        .update(clinicianProfiles)
        .set(encodeRow(clinicianProfiles, ring, { ...patch, updatedAt: new Date() }, { id }))
        .where(and(eq(clinicianProfiles.id, id), tenantWhere(clinicianProfiles, ctx)))
        .returning();
      return row ? decodeRow(clinicianProfiles, ring, row) : null;
    } catch (e) {
      if (isNpiConflict(e)) throw new NpiTaken();
      throw e;
    }
  },

  async markOnboarded(ctx: ClinicianOnlyCtx, at: Date): Promise<boolean> {
    assertNotClient(ctx);
    const rows = await db.update(clinicianProfiles).set({ onboardedAt: at, updatedAt: at }).where(tenantWhere(clinicianProfiles, ctx)).returning({ id: clinicianProfiles.id });
    return rows.length > 0;
  },
};
