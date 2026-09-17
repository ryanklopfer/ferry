import { format } from "date-fns";
import type { Claim, FollowUpType, LineItem, Plan } from "@/server/db/schema";
import { fromCents } from "./extraction";
import { appealDeadline, timelyFilingDeadline } from "./followups";

export type LetterContext = { claim: Claim; plan: Plan; lineItems: LineItem[] };

const d = (sec: number | null | undefined) => (sec ? format(new Date(sec * 1000), "MMMM d, yyyy") : "—");
const iso = (s: string | null | undefined) => (s ? format(new Date(s + "T00:00:00"), "MM/dd/yyyy") : "—");

export function claimSummaryBlock({ claim, plan, lineItems }: LetterContext) {
  const lines = lineItems.map((li) => `  - ${iso(li.serviceDate)}  CPT ${li.cptCode}${li.modifier ? "-" + li.modifier : ""} x${li.units}  $${fromCents(li.charge)}${li.description ? `  (${li.description})` : ""}`);
  return [
    `Patient: ${plan.patientName}${plan.patientDob ? ` (DOB ${iso(plan.patientDob)})` : ""}`,
    `Subscriber: ${plan.subscriberName}`,
    `Member ID: ${plan.memberId}${plan.groupNumber ? `   Group: ${plan.groupNumber}` : ""}`,
    `Provider: ${claim.providerName ?? "—"}   NPI: ${claim.providerNpi ?? "—"}   Tax ID: ${claim.providerTaxId ?? "—"}`,
    `Date(s) of service: ${iso(claim.serviceDateStart)}${claim.serviceDateEnd && claim.serviceDateEnd !== claim.serviceDateStart ? ` – ${iso(claim.serviceDateEnd)}` : ""}`,
    `Diagnosis codes: ${claim.diagnosisCodes.join(", ") || "—"}`,
    `Services:`,
    ...lines,
    `Total charged: $${fromCents(claim.totalCharged)}   Paid by patient: $${fromCents(claim.totalPaid)}`,
    claim.submittedAt ? `Submitted: ${d(claim.submittedAt)} via ${claim.submissionChannel ?? "—"}${claim.confirmationNumber ? `   Confirmation #: ${claim.confirmationNumber}` : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function coverLetter(ctx: LetterContext) {
  const { plan } = ctx;
  return `${format(new Date(), "MMMM d, yyyy")}

${plan.insurerName}
Claims Department
${plan.claimsAddress ?? ""}

RE: Out-of-network claim for reimbursement
Member: ${plan.subscriberName}   Member ID: ${plan.memberId}${plan.groupNumber ? `   Group: ${plan.groupNumber}` : ""}
Patient: ${plan.patientName}

To whom it may concern,

Enclosed please find an itemized superbill and completed claim form for services I received from an out-of-network provider. I paid the provider in full at the time of service and am requesting reimbursement under my plan's out-of-network benefits.

${claimSummaryBlock(ctx)}

Please process this claim and remit payment to the patient/subscriber at the address on file. If any additional information is needed, contact me at ${plan.patientPhone ?? plan.patientEmail ?? "the address on file"} so I can respond promptly. I would appreciate written confirmation that this claim has been received.

Thank you,

${plan.subscriberName}
${plan.patientAddress ?? ""}`;
}

export function templateFor(type: FollowUpType, ctx: LetterContext): { subject: string; body: string } {
  const { claim, plan } = ctx;
  const ref = `Member ID ${plan.memberId}${claim.confirmationNumber ? `, Claim/Confirmation # ${claim.confirmationNumber}` : ""}, DOS ${iso(claim.serviceDateStart)}`;
  const sig = `\n\nSincerely,\n${plan.subscriberName}\n${plan.patientPhone ?? ""} ${plan.patientEmail ?? ""}`.trimEnd();
  const summary = claimSummaryBlock(ctx);

  switch (type) {
    case "timely_filing_warning": {
      const dl = timelyFilingDeadline(claim, plan);
      return {
        subject: `Reminder: submit claim before ${d(dl)}`,
        body: `This claim has not been submitted yet. ${plan.insurerName} typically requires out-of-network claims within ${plan.timelyFilingDays} days of the date of service, which puts the deadline around ${d(dl)}. Generate the claim packet, submit it via ${plan.preferredChannel}, then mark the claim as submitted so follow-ups start tracking.`,
      };
    }
    case "status_inquiry":
      return {
        subject: `Status inquiry – ${ref}`,
        body: `To ${plan.insurerName} Claims Department,

I submitted the claim below on ${d(claim.submittedAt)} via ${claim.submissionChannel ?? "your claims process"} and have not received an acknowledgement or Explanation of Benefits.

${summary}

Please confirm (1) that this claim was received, (2) the claim number assigned to it, and (3) its current processing status and expected decision date. If anything is missing from the submission, tell me specifically what is required so I can provide it right away.${sig}`,
      };
    case "escalation":
      return {
        subject: `Second request – overdue claim – ${ref}`,
        body: `To ${plan.insurerName} Claims Department,

This is my second written request regarding the claim below, submitted ${d(claim.submittedAt)}. More than 30 days have passed without an Explanation of Benefits or payment.

${summary}

Most states' prompt-pay statutes require insurers to pay or deny clean claims within 30–45 days. Please process this claim immediately and provide a written explanation for the delay. If the claim has been denied or pended, send the EOB and the specific reason so I can respond.

If I do not receive a response within 10 business days, I will escalate to a supervisor and file a complaint with my state Department of Insurance.${sig}`,
      };
    case "regulator_escalation":
      return {
        subject: `Final notice before regulatory complaint – ${ref}`,
        body: `To ${plan.insurerName} Claims Department / Grievances,

I have made repeated attempts to obtain a decision on the claim below, submitted ${d(claim.submittedAt)}, without resolution. This letter is my final notice before filing a formal complaint with the state Department of Insurance and, if this is an employer plan, the U.S. Department of Labor (EBSA).

${summary}

Please pay or formally deny this claim in writing within 10 business days. Include the claim number, the adjudication date, and, if denied, the specific plan provision relied upon and my appeal rights.${sig}`,
      };
    case "info_response":
      return {
        subject: `Response to request for information – ${ref}`,
        body: `To ${plan.insurerName} Claims Department,

You requested additional information on the claim below:

"${claim.infoRequested ?? "(paste the request here)"}"

Enclosed is the requested information. [Describe what you are attaching: itemized superbill with CPT/ICD-10 codes, proof of payment, provider NPI/Tax ID, accident questionnaire, coordination of benefits form, etc.]

${summary}

Please resume processing of this claim and confirm receipt of this response.${sig}`,
      };
    case "appeal": {
      const dl = appealDeadline(claim);
      return {
        subject: `Formal appeal of claim denial – ${ref}`,
        body: `To ${plan.insurerName} Appeals Department,

I am formally appealing the denial of the claim below, dated ${d(claim.decisionAt)}. Denial reason given: "${claim.denialReason ?? "(paste the EOB reason code / text here)"}".

${summary}

I request a full review of this decision. [Address the denial reason directly: e.g., the services were medically necessary as documented by the treating provider; the plan provides out-of-network benefits for this service type; the claim was filed within the timely filing window; the provider's NPI and codes are valid.] Enclosed are the itemized superbill, proof of payment, and any supporting documentation from my provider.

Under my plan's appeal rights (and ERISA §503 if this is an employer-sponsored plan), I request a written decision within the required timeframe, a copy of all documents relied upon, and the identity of any reviewer. If this appeal is denied, please provide instructions for external review.${dl ? `\n\nNote: appeal deadline is approximately ${d(dl)} (180 days from denial).` : ""}${sig}`,
      };
    }
  }
}
