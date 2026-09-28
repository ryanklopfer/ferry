import type { Claim, ClaimLine, Event, FollowUp, Plan } from "@/server/db/schema";

export type { Claim, ClaimLine, ClaimStatus, Event, FollowUp, FollowUpType, Plan } from "@/server/db/schema";

export type ClaimView = {
  claim: Claim;
  plan: Plan;
  lines: ClaimLine[];
  followUps: FollowUp[];
  events: Event[];
  deadlines: { timelyFiling: Date | null; appeal: Date | null };
};
