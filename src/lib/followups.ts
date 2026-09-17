import type { ClaimStatus, FollowUpStatus, FollowUpType } from "@/server/db/schema";

// The engine's own inputs, in epoch seconds. Services convert database rows at the boundary.
export type FollowUpClaim = {
  status: ClaimStatus;
  serviceDateStart: string | null;
  serviceDateEnd: string | null;
  submittedAt: number | null;
  decisionAt: number | null;
  updatedAt: number;
};
export type FollowUpPlan = { timelyFilingDays: number };
export type ExistingFollowUp = { id: string; type: FollowUpType; dueAt: number; status: FollowUpStatus };

const DAY = 86_400;

export const RULES = {
  timelyFilingWarningDays: 30,
  statusInquiryDays: 14,
  escalationDays: 30,
  regulatorEscalationDays: 45,
  appealWindowDays: 180,
};

export const FOLLOW_UP_LABELS: Record<FollowUpType, string> = {
  timely_filing_warning: "Timely filing deadline approaching",
  status_inquiry: "Claim status inquiry",
  escalation: "Escalation: claim overdue",
  regulator_escalation: "Final notice before regulator complaint",
  info_response: "Respond to information request",
  appeal: "Appeal denial",
};

export type ProposedFollowUp = { type: FollowUpType; dueAt: number };

export function timelyFilingDeadline(claim: FollowUpClaim, plan: FollowUpPlan): number | null {
  const start = claim.serviceDateStart ?? claim.serviceDateEnd;
  if (!start) return null;
  // Noon UTC is the same calendar day everywhere in the US; midnight UTC displays as the evening before.
  const t = Date.parse(start + "T12:00:00Z");
  if (Number.isNaN(t)) return null;
  return Math.floor(t / 1000) + plan.timelyFilingDays * DAY;
}

export function appealDeadline(claim: FollowUpClaim): number | null {
  return claim.decisionAt ? claim.decisionAt + RULES.appealWindowDays * DAY : null;
}

/**
 * Returns follow-ups that should exist for the claim's current state but don't yet.
 * Idempotent: pass existing follow-ups and it will not re-propose the same type
 * for the same lifecycle phase (keyed by type + anchor timestamp).
 */
export function computeFollowUps(claim: FollowUpClaim, plan: FollowUpPlan, existing: ExistingFollowUp[]): ProposedFollowUp[] {
  const wanted: ProposedFollowUp[] = [];

  switch (claim.status) {
    case "draft": {
      const deadline = timelyFilingDeadline(claim, plan);
      if (deadline) wanted.push({ type: "timely_filing_warning", dueAt: deadline - RULES.timelyFilingWarningDays * DAY });
      break;
    }
    case "submitted": {
      if (claim.submittedAt) {
        wanted.push({ type: "status_inquiry", dueAt: claim.submittedAt + RULES.statusInquiryDays * DAY });
        wanted.push({ type: "escalation", dueAt: claim.submittedAt + RULES.escalationDays * DAY });
        wanted.push({ type: "regulator_escalation", dueAt: claim.submittedAt + RULES.regulatorEscalationDays * DAY });
      }
      break;
    }
    case "acknowledged": {
      if (claim.submittedAt) {
        wanted.push({ type: "escalation", dueAt: claim.submittedAt + RULES.escalationDays * DAY });
        wanted.push({ type: "regulator_escalation", dueAt: claim.submittedAt + RULES.regulatorEscalationDays * DAY });
      }
      break;
    }
    case "info_requested":
      wanted.push({ type: "info_response", dueAt: claim.decisionAt ?? claim.updatedAt });
      break;
    case "denied":
      wanted.push({ type: "appeal", dueAt: claim.decisionAt ?? claim.updatedAt });
      break;
    case "appealed": {
      const anchor = claim.decisionAt ?? claim.updatedAt;
      wanted.push({ type: "status_inquiry", dueAt: anchor + RULES.escalationDays * DAY });
      break;
    }
    case "paid":
    case "closed":
      break;
  }

  return wanted.filter((w) => !existing.some((e) => e.type === w.type && e.dueAt === w.dueAt));
}

/** Follow-ups that no longer apply to the claim's current state. */
export function staleFollowUps<T extends ExistingFollowUp>(claim: FollowUpClaim, existing: T[]): T[] {
  const openTypes = new Set<FollowUpType>();
  const phase: Record<ClaimStatus, FollowUpType[]> = {
    draft: ["timely_filing_warning"],
    submitted: ["status_inquiry", "escalation", "regulator_escalation"],
    acknowledged: ["escalation", "regulator_escalation"],
    info_requested: ["info_response"],
    denied: ["appeal"],
    appealed: ["status_inquiry"],
    paid: [],
    closed: [],
  };
  phase[claim.status].forEach((t) => openTypes.add(t));
  return existing.filter((f) => (f.status === "pending" || f.status === "drafted") && !openTypes.has(f.type));
}

export function isDue(f: Pick<ExistingFollowUp, "dueAt" | "status">, nowSec = Math.floor(Date.now() / 1000)) {
  return (f.status === "pending" || f.status === "drafted") && f.dueAt <= nowSec;
}
