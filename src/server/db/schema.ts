import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { ClaimStatus, FollowUpStatus, FollowUpType } from "../../core/claim/status";
import { users } from "./auth-schema";

export * from "./auth-schema";
export { CLAIM_STATUSES, type ClaimStatus, FOLLOW_UP_STATUSES, type FollowUpStatus, FOLLOW_UP_TYPES, type FollowUpType } from "../../core/claim/status";

const id = () => text("id").primaryKey();
const owner = () => text("user_id").notNull().references(() => users.id, { onDelete: "cascade" });
const at = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => at("created_at").notNull().defaultNow();

export const plans = pgTable(
  "plans",
  {
    id: id(),
    userId: owner(),
    insurerName: text("insurer_name").notNull(),
    planName: text("plan_name"),
    memberId: text("member_id").notNull(),
    groupNumber: text("group_number"),
    subscriberName: text("subscriber_name").notNull(),
    subscriberDob: date("subscriber_dob", { mode: "string" }),
    patientName: text("patient_name").notNull(),
    patientDob: date("patient_dob", { mode: "string" }),
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
    createdAt: createdAt(),
  },
  (t) => [index("plans_user_idx").on(t.userId)],
);

export const TAX_ID_TYPES = ["EIN", "SSN"] as const;
export type TaxIdType = (typeof TAX_ID_TYPES)[number];

// What this patient told us about a provider. Never shared between patients; the public
// registry copy (S6) and provider-controlled accounts (S24) are separate tables.
export const providers = pgTable(
  "providers",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    npi: text("npi"),
    taxId: text("tax_id"),
    taxIdType: text("tax_id_type").$type<TaxIdType>(),
    address: text("address"),
    phone: text("phone"),
    credential: text("credential"),
    license: text("license"),
    createdAt: createdAt(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [index("providers_user_idx").on(t.userId), uniqueIndex("providers_user_npi_idx").on(t.userId, t.npi)],
);

export const claims = pgTable(
  "claims",
  {
    id: id(),
    userId: owner(),
    planId: text("plan_id").notNull().references(() => plans.id),
    status: text("status").$type<ClaimStatus>().notNull().default("draft"),
    billingProviderId: text("billing_provider_id").references(() => providers.id, { onDelete: "set null" }),
    renderingProviderId: text("rendering_provider_id").references(() => providers.id, { onDelete: "set null" }),
    billingProviderName: text("billing_provider_name"),
    billingProviderNpi: text("billing_provider_npi"),
    billingProviderTaxId: text("billing_provider_tax_id"),
    billingProviderTaxIdType: text("billing_provider_tax_id_type").$type<TaxIdType>(),
    billingProviderAddress: text("billing_provider_address"),
    billingProviderPhone: text("billing_provider_phone"),
    renderingProviderName: text("rendering_provider_name"),
    renderingProviderNpi: text("rendering_provider_npi"),
    renderingProviderCredential: text("rendering_provider_credential"),
    renderingProviderLicense: text("rendering_provider_license"),
    serviceDateStart: date("service_date_start", { mode: "string" }),
    serviceDateEnd: date("service_date_end", { mode: "string" }),
    placeOfService: text("place_of_service").default("11"),
    diagnosisCodes: jsonb("diagnosis_codes").$type<string[]>().notNull().default([]),
    totalCharged: integer("total_charged").notNull().default(0),
    totalPaid: integer("total_paid").notNull().default(0),
    amountReimbursed: integer("amount_reimbursed"),
    extractionNotes: text("extraction_notes"),
    submittedAt: at("submitted_at"),
    submissionChannel: text("submission_channel"),
    confirmationNumber: text("confirmation_number"),
    decisionAt: at("decision_at"),
    denialReason: text("denial_reason"),
    infoRequested: text("info_requested"),
    createdAt: createdAt(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [index("claims_user_idx").on(t.userId)],
);

export const claimLines = pgTable(
  "claim_lines",
  {
    id: id(),
    userId: owner(),
    claimId: text("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    serviceDate: date("service_date", { mode: "string" }),
    cptCode: text("cpt_code").notNull(),
    modifiers: text("modifiers").array().notNull().default(sql`'{}'::text[]`),
    description: text("description"),
    units: integer("units").notNull().default(1),
    charge: integer("charge").notNull().default(0),
    diagnosisPointers: integer("diagnosis_pointers").array().notNull().default(sql`'{1}'::integer[]`),
    placeOfService: text("place_of_service"),
  },
  (t) => [index("claim_lines_claim_idx").on(t.claimId), check("claim_lines_max_4_modifiers", sql`cardinality(${t.modifiers}) <= 4`)],
);

export const DOCUMENT_KINDS = ["superbill", "card_front", "card_back", "eob", "letter", "packet"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const documents = pgTable(
  "documents",
  {
    id: id(),
    userId: owner(),
    claimId: text("claim_id").references(() => claims.id, { onDelete: "cascade" }),
    kind: text("kind").$type<DocumentKind>().notNull(),
    storageKey: text("storage_key").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("documents_claim_idx").on(t.claimId)],
);

export const followUps = pgTable(
  "follow_ups",
  {
    id: id(),
    userId: owner(),
    claimId: text("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    type: text("type").$type<FollowUpType>().notNull(),
    dueAt: at("due_at").notNull(),
    status: text("status").$type<FollowUpStatus>().notNull().default("pending"),
    draftSubject: text("draft_subject"),
    draftBody: text("draft_body"),
    sentAt: at("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [index("follow_ups_claim_idx").on(t.claimId)],
);

export const events = pgTable(
  "events",
  {
    id: id(),
    userId: owner(),
    claimId: text("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("events_claim_idx").on(t.claimId)],
);

export type Plan = typeof plans.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type ClaimLine = typeof claimLines.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Event = typeof events.$inferSelect;
