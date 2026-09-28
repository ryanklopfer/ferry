import type { Normalizer } from "@/server/crypto/blind";

// Every text, jsonb, bytea or text[] column outside the auth tables is classified here, by SQL name, and
// columns.test.ts fails on one that isn't. The column codec (codec.ts) reads SEALED, BLIND_INDEXES, LAST4 and
// SEALED_DEFAULTS from here, so sealing a new column is one line in this file.

// Better Auth owns these and looks rows up by their plaintext columns, so they are excluded by name:
// - users.email stays plaintext because Better Auth signs people in by it; RDS encryption at rest protects it.
// - users.name never holds a client's name: client users get their email's local part, and acceptInvite (N7a)
//   never copies the clients row's name into it.
export const AUTH_TABLES = ["users", "sessions", "accounts", "verifications", "passkeys"] as const;

// Sealed under the tenant's data key (AES-256-GCM); the repos decode them for any Ctx of that tenant.
export const SEALED: Record<string, readonly string[]> = {
  clients: ["first_name", "last_name", "dob", "email", "phone"],
  plans: ["member_id", "group_number", "subscriber_name", "subscriber_dob", "patient_name", "patient_dob", "patient_relationship", "patient_address", "patient_phone", "patient_email"],
  providers: ["tax_id", "address", "phone"],
  claims: ["billing_provider_tax_id", "billing_provider_address", "billing_provider_phone", "diagnosis_codes", "extraction_notes", "confirmation_number", "denial_reason", "info_requested"],
  claim_lines: ["cpt_code", "description"],
  follow_ups: ["draft_subject", "draft_body"],
  events: ["note"],
};

// Sealed under a per-record key in the EphemeralKeyStore, erased at 24 hours (transcripts, dictation, rough
// notes and unconfirmed scan fields arrive in N8, N12 and S5).
export const EPHEMERAL: Record<string, readonly string[]> = {};

const ID = "opaque prefixed id";
const TENANT = "the clinician tenant's user id";
const CLINICIAN = "the member clinician's own public NPPES data, not about a client";
const PAYER = "the insurer's public routing data, not about a client";
const BIDX = "HMAC blind index under the tenant's index key; reveals nothing without it";
const LAST4 = "last four of a Tax ID, the only part ever shown";
const ENUM = "a closed set of codes";

export const PLAINTEXT_OK: Record<string, Record<string, string>> = {
  clients: { id: ID, user_id: TENANT, email_bidx: BIDX, phone_bidx: BIDX, client_user_id: "the bound client user's id" },
  client_memberships: { id: ID, user_id: "the client user's id", clinician_user_id: TENANT, client_id: ID, status: ENUM },
  plans: {
    id: ID,
    user_id: TENANT,
    client_id: ID,
    insurer_name: "payer name; routes and chases the claim",
    plan_name: "product name printed on every card of that plan",
    member_id_bidx: BIDX,
    claims_address: PAYER,
    claims_fax: PAYER,
    claims_phone: PAYER,
    portal_url: PAYER,
    preferred_channel: ENUM,
  },
  providers: {
    id: ID,
    user_id: TENANT,
    name: CLINICIAN,
    npi: CLINICIAN,
    tax_id_last4: LAST4,
    tax_id_type: ENUM,
    credential: CLINICIAN,
    license: "state license number, public on the licensing board's site",
  },
  claims: {
    id: ID,
    user_id: TENANT,
    client_id: ID,
    plan_id: ID,
    status: ENUM,
    billing_provider_id: ID,
    rendering_provider_id: ID,
    billing_provider_name: CLINICIAN,
    billing_provider_npi: CLINICIAN,
    billing_provider_tax_id_last4: LAST4,
    billing_provider_tax_id_type: ENUM,
    rendering_provider_name: CLINICIAN,
    rendering_provider_npi: CLINICIAN,
    rendering_provider_credential: CLINICIAN,
    rendering_provider_license: CLINICIAN,
    place_of_service: "two-digit CMS place-of-service code",
    submission_channel: ENUM,
  },
  claim_lines: {
    id: ID,
    user_id: TENANT,
    client_id: ID,
    claim_id: ID,
    modifiers: "billing modifiers (95, GT, HO); the database CHECK caps them at four",
    place_of_service: "two-digit CMS place-of-service code",
  },
  follow_ups: { id: ID, user_id: TENANT, claim_id: ID, type: ENUM, status: ENUM },
  events: { id: ID, user_id: TENANT, client_id: ID, claim_id: ID, type: ENUM },
  tenant_keys: { key_id: "names the key; not key material", user_id: TENANT, kek_ref: "names the key-encryption key", wrapped_key: "the data key encrypted by the KeyProvider; useless without it" },
};

// Written by the codec whenever its source column is written.
export const BLIND_INDEXES: Record<string, Record<string, { source: string; normalize: Normalizer }>> = {
  clients: { email_bidx: { source: "email", normalize: "email" }, phone_bidx: { source: "phone", normalize: "phone" } },
  plans: { member_id_bidx: { source: "member_id", normalize: "memberId" } },
};

export const LAST4_OF: Record<string, Record<string, string>> = {
  providers: { tax_id_last4: "tax_id" },
  claims: { billing_provider_tax_id_last4: "billing_provider_tax_id" },
};

// A database default would be plaintext, so sealed columns have none; the codec fills these on insert.
export const SEALED_DEFAULTS: Record<string, Record<string, unknown>> = {
  plans: { patient_relationship: "self" },
  claims: { diagnosis_codes: [] },
};
