export const CLAIM_STATUSES = ["draft", "submitted", "acknowledged", "info_requested", "denied", "appealed", "paid", "closed"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const FOLLOW_UP_TYPES = ["timely_filing_warning", "status_inquiry", "escalation", "regulator_escalation", "info_response", "appeal"] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const FOLLOW_UP_STATUSES = ["pending", "drafted", "sent", "dismissed"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];
