import type { Claim, FollowUp } from "@/server/db/schema";
import type { ExistingFollowUp, FollowUpClaim } from "./followups";

export const toSec = (d: Date) => Math.floor(d.getTime() / 1000);
export const fromSec = (sec: number) => new Date(sec * 1000);

export const toEngineClaim = (c: Pick<Claim, "status" | "serviceDateStart" | "serviceDateEnd" | "submittedAt" | "decisionAt" | "updatedAt">): FollowUpClaim => ({
  status: c.status,
  serviceDateStart: c.serviceDateStart,
  serviceDateEnd: c.serviceDateEnd,
  submittedAt: c.submittedAt ? toSec(c.submittedAt) : null,
  decisionAt: c.decisionAt ? toSec(c.decisionAt) : null,
  updatedAt: toSec(c.updatedAt),
});

export const toEngineFollowUp = (f: Pick<FollowUp, "id" | "type" | "dueAt" | "status">): ExistingFollowUp => ({
  id: f.id,
  type: f.type,
  dueAt: toSec(f.dueAt),
  status: f.status,
});
