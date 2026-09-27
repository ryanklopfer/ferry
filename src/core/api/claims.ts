import { z } from "zod";
import { CLAIM_STATUSES, FOLLOW_UP_STATUSES, FOLLOW_UP_TYPES } from "../claim/status";

// Wire shapes for /api/v1. Strict on purpose: a field that is not listed here cannot leave the server.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z.iso.datetime();
const cents = z.number().int();

export const ApiErrorSchema = z.strictObject({
  code: z.enum(["unauthorized", "not_found", "invalid_request"]),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ClaimSummarySchema = z.strictObject({
  id: z.string().startsWith("clm_"),
  status: z.enum(CLAIM_STATUSES),
  insurerName: z.string(),
  billingProviderName: z.string().nullable(),
  serviceDateStart: isoDate.nullable(),
  serviceDateEnd: isoDate.nullable(),
  totalChargedCents: cents,
  amountReimbursedCents: cents.nullable(),
  updatedAt: instant,
});
export type ClaimSummary = z.infer<typeof ClaimSummarySchema>;

export const ClaimDetailSchema = ClaimSummarySchema.extend({
  planId: z.string().startsWith("pln_"),
  renderingProviderName: z.string().nullable(),
  placeOfService: z.string().nullable(),
  diagnosisCodes: z.array(z.string()),
  totalPaidCents: cents,
  submittedAt: instant.nullable(),
  decisionAt: instant.nullable(),
  timelyFilingDeadline: instant.nullable(),
  appealDeadline: instant.nullable(),
  lines: z.array(
    z.strictObject({
      serviceDate: isoDate.nullable(),
      cptCode: z.string(),
      modifiers: z.array(z.string()).max(4),
      description: z.string().nullable(),
      units: z.number().int(),
      chargeCents: cents,
      diagnosisPointers: z.array(z.number().int()),
      placeOfService: z.string().nullable(),
    }),
  ),
  followUps: z.array(z.strictObject({ id: z.string(), type: z.enum(FOLLOW_UP_TYPES), status: z.enum(FOLLOW_UP_STATUSES), dueAt: instant })),
  timeline: z.array(z.strictObject({ type: z.string(), at: instant })),
});
export type ClaimDetail = z.infer<typeof ClaimDetailSchema>;

export const ClaimListSchema = z.strictObject({ claims: z.array(ClaimSummarySchema) });
