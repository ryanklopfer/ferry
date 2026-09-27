import { z } from "zod";
import type { ClinicianOnlyCtx } from "@/server/auth/ctx";
import { plansRepo } from "@/server/db/repos/plans";
import type { Plan } from "./types";

const text = z.string().trim().min(1);
const optional = text.nullish().transform((v) => v ?? null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().transform((v) => v ?? null);

export const PlanInputSchema = z.object({
  insurerName: text,
  planName: optional,
  memberId: text,
  groupNumber: optional,
  subscriberName: text,
  subscriberDob: isoDate,
  patientName: optional,
  patientDob: isoDate,
  patientRelationship: z.enum(["self", "spouse", "child", "other"]).default("self"),
  patientAddress: optional,
  patientPhone: optional,
  patientEmail: optional,
  claimsAddress: optional,
  claimsFax: optional,
  claimsPhone: optional,
  portalUrl: optional,
  preferredChannel: z.enum(["portal", "fax", "mail", "email"]).default("portal"),
  timelyFilingDays: z.number().int().min(1).max(1095).default(180),
});
export type PlanInput = z.input<typeof PlanInputSchema>;

export function listPlans(ctx: ClinicianOnlyCtx): Promise<Plan[]> {
  return plansRepo.list(ctx);
}

export function createPlan(ctx: ClinicianOnlyCtx, input: PlanInput): Promise<Plan> {
  const v = PlanInputSchema.parse(input);
  return plansRepo.create(ctx, { ...v, patientName: v.patientName ?? v.subscriberName, patientDob: v.patientDob ?? v.subscriberDob });
}
