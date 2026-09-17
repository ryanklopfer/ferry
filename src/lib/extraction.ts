import { z } from "zod";

export const ExtractionSchema = z.object({
  providerName: z.string().nullable(),
  providerNpi: z.string().nullable(),
  providerTaxId: z.string().nullable(),
  providerAddress: z.string().nullable(),
  providerPhone: z.string().nullable(),
  patientName: z.string().nullable(),
  placeOfService: z.string().nullable(),
  diagnosisCodes: z.array(z.string()),
  lineItems: z.array(
    z.object({
      serviceDate: z.string().nullable(),
      cptCode: z.string(),
      modifier: z.string().nullable(),
      description: z.string().nullable(),
      units: z.number().int().positive().default(1),
      charge: z.number().nonnegative(),
    }),
  ),
  totalCharged: z.number().nullable(),
  totalPaid: z.number().nullable(),
  notes: z.string().nullable(),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export const EMPTY_EXTRACTION: Extraction = {
  providerName: null,
  providerNpi: null,
  providerTaxId: null,
  providerAddress: null,
  providerPhone: null,
  patientName: null,
  placeOfService: "11",
  diagnosisCodes: [],
  lineItems: [],
  totalCharged: null,
  totalPaid: null,
  notes: null,
};

export const EXTRACTION_PROMPT = `You are reading a medical superbill (an itemized receipt from a healthcare provider used for out-of-network insurance reimbursement).

Extract every field you can find and return ONLY a JSON object with this exact shape:
{
  "providerName": string|null,        // practice or clinician name as printed
  "providerNpi": string|null,         // 10-digit National Provider Identifier
  "providerTaxId": string|null,       // EIN / Tax ID, e.g. 12-3456789
  "providerAddress": string|null,     // single line
  "providerPhone": string|null,
  "patientName": string|null,
  "placeOfService": string|null,      // 2-digit POS code if printed (11 = office, 10/02 = telehealth), else null
  "diagnosisCodes": string[],         // ICD-10 codes, e.g. "M54.5"
  "lineItems": [{
    "serviceDate": "YYYY-MM-DD"|null,
    "cptCode": string,                // 5-character CPT/HCPCS code
    "modifier": string|null,
    "description": string|null,
    "units": number,
    "charge": number                  // dollars for this line (units x rate)
  }],
  "totalCharged": number|null,        // dollars
  "totalPaid": number|null,           // dollars the patient already paid, if shown
  "notes": string|null                // anything ambiguous, illegible, or missing that the patient should double-check
}

Rules: dates as YYYY-MM-DD; money as plain numbers (no $ or commas); do not invent codes that are not printed; if a value is unreadable set it to null and mention it in notes.`;

export function parseExtraction(raw: string): Extraction {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  const json = JSON.parse(raw.slice(start, end + 1));
  return ExtractionSchema.parse(json);
}

export const toCents = (dollars: number | null | undefined) => Math.round((dollars ?? 0) * 100);
export const fromCents = (cents: number | null | undefined) => ((cents ?? 0) / 100).toFixed(2);
