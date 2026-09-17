import type { Claim, ClaimLine, Document, Event, FollowUp, Plan } from "@/server/db/schema";

export type { Claim, ClaimLine, ClaimStatus, Document, Event, FollowUp, FollowUpType, Plan, Provider } from "@/server/db/schema";

export type ClaimView = {
  claim: Claim;
  plan: Plan;
  lines: ClaimLine[];
  followUps: FollowUp[];
  events: Event[];
  superbill: Document | null;
  deadlines: { timelyFiling: Date | null; appeal: Date | null };
};
