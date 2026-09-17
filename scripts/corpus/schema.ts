import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const AddressSchema = z.object({
  line1: z.string(),
  city: z.string(),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}$/),
});

export const LineSchema = z.object({
  serviceDate: isoDate,
  cpt: z.string().regex(/^[0-9A-Z]{5}$/),
  modifiers: z.array(z.string().regex(/^[0-9A-Z]{2}$/)).max(4),
  units: z.number().int().positive(),
  chargeCents: z.number().int().nonnegative(),
  diagnosisPointers: z.array(z.number().int().min(1).max(12)).min(1),
  placeOfService: z.string().regex(/^\d{2}$/),
  description: z.string(),
});

export const SuperbillLabelSchema = z.object({
  id: z.string(),
  files: z.array(z.string()).min(1),
  cases: z.array(z.string()).min(1),
  billingProvider: z.object({
    name: z.string(),
    npi: z.string().nullable(),
    taxId: z.string().nullable(),
    taxIdType: z.enum(["EIN", "SSN"]).nullable(),
    address: AddressSchema,
    phone: z.string().nullable(),
  }),
  renderingProvider: z.object({
    name: z.string(),
    npi: z.string().nullable(),
    credential: z.string().nullable(),
    license: z.string().nullable(),
  }),
  patient: z.object({ name: z.string(), dob: isoDate.nullable(), address: AddressSchema.nullable() }),
  diagnosisCodes: z.array(z.string().regex(/^[A-Z]\d{2}(\.[0-9A-Z]{1,4})?$/)).min(1),
  lines: z.array(LineSchema).min(1),
  totalChargedCents: z.number().int(),
  totalPaidCents: z.number().int(),
  expectedFlags: z.array(z.string()),
});
export type SuperbillLabel = z.infer<typeof SuperbillLabelSchema>;

export const CardLabelSchema = z.object({
  id: z.string(),
  files: z.array(z.string()).min(1),
  payerName: z.string(),
  payerDirectoryKey: z.string().nullable(),
  planName: z.string().nullable(),
  planType: z.enum(["PPO", "POS", "HDHP", "EPO", "HMO", "MEDICAID", "MEDICARE"]),
  gated: z.boolean(),
  memberId: z.string(),
  groupNumber: z.string().nullable(),
  subscriberName: z.string(),
  claimsAddress: z.string().nullable(),
  payerPhone: z.string().nullable(),
});
export type CardLabel = z.infer<typeof CardLabelSchema>;

export const LabelsFileSchema = z.object({
  generatedBy: z.string(),
  note: z.string(),
  superbills: z.array(SuperbillLabelSchema),
  cards: z.array(CardLabelSchema),
});
