import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { ClaimStatus, FollowUpStatus, FollowUpType } from "../../core/claim/status";
import { CLIENT_DOC_TYPES, CLINICIAN_DOC_TYPES, type ClientDocType, type ClinicianDocType, SIGNER_RELATIONSHIPS, type SignerRelationship } from "../../core/legal";
import { users } from "./auth-schema";

export * from "./auth-schema";
export { CLAIM_STATUSES, type ClaimStatus, FOLLOW_UP_STATUSES, type FollowUpStatus, FOLLOW_UP_TYPES, type FollowUpType } from "../../core/claim/status";

const id = () => text("id").primaryKey();
const owner = () => text("user_id").notNull().references(() => users.id, { onDelete: "cascade" });
const at = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => at("created_at").notNull().defaultNow();
// Stored as v1.<keyId>.<iv>.<ct>.<tag> under the tenant key; typed as the value the repos hand back after
// decoding. Only the column codec (codec.ts, driven by columns.ts) reads or writes these.
const sealed = <T = string>(name: string) => text(name).$type<T>();

// The clinician's client (CLIENT_SELF). Names, DOB and contact are sealed; the blind indexes find a client by contact.
export const clients = pgTable(
  "clients",
  {
    id: id(),
    userId: owner(),
    firstName: sealed("first_name").notNull(),
    lastName: sealed("last_name").notNull(),
    dob: sealed("dob"),
    email: sealed("email"),
    phone: sealed("phone"),
    emailBidx: text("email_bidx"),
    phoneBidx: text("phone_bidx"),
    clientUserId: text("client_user_id").references(() => users.id, { onDelete: "set null" }),
    archivedAt: at("archived_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("clients_user_idx").on(t.userId),
    uniqueIndex("clients_user_client_user_idx").on(t.userId, t.clientUserId),
    index("clients_email_bidx_idx").on(t.userId, t.emailBidx),
    index("clients_phone_bidx_idx").on(t.userId, t.phoneBidx),
  ],
);

export const MEMBERSHIP_STATUSES = ["active", "revoked"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

// How a client user reaches their record. user_id is the client user, not a tenant; one active membership per clinician.
export const clientMemberships = pgTable(
  "client_memberships",
  {
    id: id(),
    userId: owner(),
    clinicianUserId: text("clinician_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    status: text("status").$type<MembershipStatus>().notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    index("client_memberships_user_idx").on(t.userId),
    uniqueIndex("client_memberships_active_idx").on(t.userId, t.clinicianUserId).where(sql`${t.status} = 'active'`),
    check("client_memberships_status", sql`${t.status} in ('active', 'revoked')`),
  ],
);

const clientRef = () => text("client_id").notNull().references(() => clients.id);

export const plans = pgTable(
  "plans",
  {
    id: id(),
    userId: owner(),
    clientId: clientRef(),
    insurerName: text("insurer_name").notNull(),
    planName: text("plan_name"),
    memberId: sealed("member_id").notNull(),
    memberIdBidx: text("member_id_bidx"),
    groupNumber: sealed("group_number"),
    subscriberName: sealed("subscriber_name").notNull(),
    subscriberDob: sealed("subscriber_dob"),
    patientName: sealed("patient_name").notNull(),
    patientDob: sealed("patient_dob"),
    patientRelationship: sealed("patient_relationship").notNull(),
    patientAddress: sealed("patient_address"),
    patientPhone: sealed("patient_phone"),
    patientEmail: sealed("patient_email"),
    claimsAddress: text("claims_address"),
    claimsFax: text("claims_fax"),
    claimsPhone: text("claims_phone"),
    portalUrl: text("portal_url"),
    preferredChannel: text("preferred_channel").notNull().default("portal"),
    timelyFilingDays: integer("timely_filing_days").notNull().default(180),
    createdAt: createdAt(),
  },
  (t) => [index("plans_user_idx").on(t.userId), index("plans_client_idx").on(t.clientId), index("plans_member_id_bidx_idx").on(t.userId, t.memberIdBidx)],
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
    taxId: sealed("tax_id"),
    taxIdLast4: text("tax_id_last4"),
    taxIdType: text("tax_id_type").$type<TaxIdType>(),
    address: sealed("address"),
    phone: sealed("phone"),
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
    clientId: clientRef(),
    planId: text("plan_id").notNull().references(() => plans.id),
    status: text("status").$type<ClaimStatus>().notNull().default("draft"),
    billingProviderId: text("billing_provider_id").references(() => providers.id, { onDelete: "set null" }),
    renderingProviderId: text("rendering_provider_id").references(() => providers.id, { onDelete: "set null" }),
    billingProviderName: text("billing_provider_name"),
    billingProviderNpi: text("billing_provider_npi"),
    billingProviderTaxId: sealed("billing_provider_tax_id"),
    billingProviderTaxIdLast4: text("billing_provider_tax_id_last4"),
    billingProviderTaxIdType: text("billing_provider_tax_id_type").$type<TaxIdType>(),
    billingProviderAddress: sealed("billing_provider_address"),
    billingProviderPhone: sealed("billing_provider_phone"),
    renderingProviderName: text("rendering_provider_name"),
    renderingProviderNpi: text("rendering_provider_npi"),
    renderingProviderCredential: text("rendering_provider_credential"),
    renderingProviderLicense: text("rendering_provider_license"),
    serviceDateStart: date("service_date_start", { mode: "string" }),
    serviceDateEnd: date("service_date_end", { mode: "string" }),
    placeOfService: text("place_of_service").default("11"),
    diagnosisCodes: sealed<string[]>("diagnosis_codes").notNull(),
    totalCharged: integer("total_charged").notNull().default(0),
    totalPaid: integer("total_paid").notNull().default(0),
    amountReimbursed: integer("amount_reimbursed"),
    extractionNotes: sealed("extraction_notes"),
    submittedAt: at("submitted_at"),
    submissionChannel: text("submission_channel"),
    confirmationNumber: sealed("confirmation_number"),
    decisionAt: at("decision_at"),
    denialReason: sealed("denial_reason"),
    infoRequested: sealed("info_requested"),
    createdAt: createdAt(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [index("claims_user_idx").on(t.userId), index("claims_client_idx").on(t.clientId)],
);

export const claimLines = pgTable(
  "claim_lines",
  {
    id: id(),
    userId: owner(),
    clientId: clientRef(),
    claimId: text("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    serviceDate: date("service_date", { mode: "string" }),
    cptCode: sealed("cpt_code").notNull(),
    modifiers: text("modifiers").array().notNull().default(sql`'{}'::text[]`),
    description: sealed("description"),
    units: integer("units").notNull().default(1),
    charge: integer("charge").notNull().default(0),
    diagnosisPointers: integer("diagnosis_pointers").array().notNull().default(sql`'{1}'::integer[]`),
    placeOfService: text("place_of_service"),
  },
  (t) => [index("claim_lines_claim_idx").on(t.claimId), check("claim_lines_max_4_modifiers", sql`cardinality(${t.modifiers}) <= 4`)],
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
    draftSubject: sealed("draft_subject"),
    draftBody: sealed("draft_body"),
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
    clientId: clientRef(),
    claimId: text("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    note: sealed("note"),
    createdAt: createdAt(),
  },
  (t) => [index("events_claim_idx").on(t.claimId)],
);

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

// The clinician's own agreements (terms, privacy, BAA, filing authorization). Clinician-only: no client context reads it.
// A new version of a text adds a row; rows are never edited except to set withdrawn_at.
export const clinicianConsents = pgTable(
  "clinician_consents",
  {
    id: id(),
    userId: owner(),
    docType: text("doc_type").$type<ClinicianDocType>().notNull(),
    version: text("version").notNull(),
    contentHash: text("content_hash").notNull(),
    typedName: sealed("typed_name").notNull(),
    ip: sealed("ip"),
    userAgent: sealed("user_agent"),
    createdAt: createdAt(),
    withdrawnAt: at("withdrawn_at"),
  },
  (t) => [
    index("clinician_consents_user_idx").on(t.userId, t.docType),
    check("clinician_consents_doc_type", sql`${t.docType} in (${inList(CLINICIAN_DOC_TYPES)})`),
  ],
);

// A client's consents to filing and to recording, signed by the client or for them (actor_user_id). CLIENT_SCOPED.
export const clientConsents = pgTable(
  "client_consents",
  {
    id: id(),
    userId: owner(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull().references(() => users.id),
    docType: text("doc_type").$type<ClientDocType>().notNull(),
    signerRelationship: text("signer_relationship").$type<SignerRelationship>().notNull(),
    version: text("version").notNull(),
    contentHash: text("content_hash").notNull(),
    typedName: sealed("typed_name").notNull(),
    ip: sealed("ip"),
    userAgent: sealed("user_agent"),
    createdAt: createdAt(),
    withdrawnAt: at("withdrawn_at"),
  },
  (t) => [
    index("client_consents_client_idx").on(t.userId, t.clientId, t.docType),
    check("client_consents_doc_type", sql`${t.docType} in (${inList(CLIENT_DOC_TYPES)})`),
    check("client_consents_signer", sql`${t.signerRelationship} in (${inList(SIGNER_RELATIONSHIPS)})`),
  ],
);

// One data key per clinician tenant (plus a separate blind-index key), wrapped by the KeyProvider's key-encryption
// key. Deleting the clinician's user row deletes the key, which crypto-shreds everything sealed under it.
export const tenantKeys = pgTable("tenant_keys", {
  keyId: text("key_id").primaryKey(),
  userId: owner().unique(),
  kekRef: text("kek_ref").notNull(),
  wrappedKey: text("wrapped_key").notNull(),
  createdAt: createdAt(),
});

export type Client = typeof clients.$inferSelect;
export type ClientMembership = typeof clientMemberships.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type ClaimLine = typeof claimLines.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Event = typeof events.$inferSelect;
export type ClinicianConsent = typeof clinicianConsents.$inferSelect;
export type ClientConsent = typeof clientConsents.$inferSelect;
