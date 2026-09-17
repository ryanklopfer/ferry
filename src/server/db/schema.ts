import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

const now = () => sql`(extract(epoch from now())::integer)`;
const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();

export const plans = pgTable("plans", {
  id: id(),
  insurerName: text("insurer_name").notNull(),
  planName: text("plan_name"),
  memberId: text("member_id").notNull(),
  groupNumber: text("group_number"),
  subscriberName: text("subscriber_name").notNull(),
  subscriberDob: text("subscriber_dob"),
  patientName: text("patient_name").notNull(),
  patientDob: text("patient_dob"),
  patientRelationship: text("patient_relationship").notNull().default("self"),
  patientAddress: text("patient_address"),
  patientPhone: text("patient_phone"),
  patientEmail: text("patient_email"),
  claimsAddress: text("claims_address"),
  claimsFax: text("claims_fax"),
  claimsPhone: text("claims_phone"),
  portalUrl: text("portal_url"),
  preferredChannel: text("preferred_channel").notNull().default("portal"),
  timelyFilingDays: integer("timely_filing_days").notNull().default(180),
  createdAt: integer("created_at").notNull().default(now()),
});

export const CLAIM_STATUSES = [
  "draft",
  "submitted",
  "acknowledged",
  "info_requested",
  "denied",
  "appealed",
  "paid",
  "closed",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const claims = pgTable("claims", {
  id: id(),
  planId: integer("plan_id").notNull().references(() => plans.id),
  status: text("status").$type<ClaimStatus>().notNull().default("draft"),
  providerName: text("provider_name"),
  providerNpi: text("provider_npi"),
  providerTaxId: text("provider_tax_id"),
  providerAddress: text("provider_address"),
  providerPhone: text("provider_phone"),
  serviceDateStart: text("service_date_start"),
  serviceDateEnd: text("service_date_end"),
  placeOfService: text("place_of_service").default("11"),
  diagnosisCodes: jsonb("diagnosis_codes").$type<string[]>().notNull().default([]),
  totalCharged: integer("total_charged").notNull().default(0),
  totalPaid: integer("total_paid").notNull().default(0),
  superbillPath: text("superbill_path"),
  superbillMime: text("superbill_mime"),
  extractionNotes: text("extraction_notes"),
  submittedAt: integer("submitted_at"),
  submissionChannel: text("submission_channel"),
  confirmationNumber: text("confirmation_number"),
  decisionAt: integer("decision_at"),
  denialReason: text("denial_reason"),
  infoRequested: text("info_requested"),
  amountReimbursed: integer("amount_reimbursed"),
  createdAt: integer("created_at").notNull().default(now()),
  updatedAt: integer("updated_at").notNull().default(now()),
});

export const lineItems = pgTable("line_items", {
  id: id(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  serviceDate: text("service_date"),
  cptCode: text("cpt_code").notNull(),
  modifier: text("modifier"),
  description: text("description"),
  units: integer("units").notNull().default(1),
  charge: integer("charge").notNull().default(0),
});

export const FOLLOW_UP_TYPES = [
  "timely_filing_warning",
  "status_inquiry",
  "escalation",
  "regulator_escalation",
  "info_response",
  "appeal",
] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const followUps = pgTable("follow_ups", {
  id: id(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  type: text("type").$type<FollowUpType>().notNull(),
  dueAt: integer("due_at").notNull(),
  status: text("status").$type<"pending" | "drafted" | "sent" | "dismissed">().notNull().default("pending"),
  draftSubject: text("draft_subject"),
  draftBody: text("draft_body"),
  sentAt: integer("sent_at"),
  createdAt: integer("created_at").notNull().default(now()),
});

export const events = pgTable("events", {
  id: id(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  note: text("note"),
  createdAt: integer("created_at").notNull().default(now()),
});

export type Plan = typeof plans.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type LineItem = typeof lineItems.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Event = typeof events.$inferSelect;
