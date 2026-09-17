# Clearinghouse vendor evaluation (2026-09-17)

Decision: **Stedi** primary, **Claim.MD** warm backup. Optum/Availity only if a specific payer forces it.

## Two facts that shape the architecture

1. **835 ERA always needs per-provider, per-payer enrollment, and it is exclusive to one clearinghouse.** A therapist who already gets ERAs through SimplePractice/TherapyNotes/Office Ally cannot also send them to us; enrolling her through us would steal her feed. So the loop's primary adjudication signal is **276/277 claim status** (no enrollment at most payers) plus **patient EOB upload** (the payer always mails the patient an EOB on a non-assigned claim). 835 is a bonus where a provider chooses to ERA-enroll through us.
2. **837P and 270/271 usually need no enrollment for commercial payers**, but Medicare, most Medicaid, and some Blues require per-provider enrollment, and Medicare forbids a third party from signing it. Stedi's Payers API returns `transactionSupport` = SUPPORTED / ENROLLMENT_REQUIRED / NOT_SUPPORTED per payer per transaction — route on that flag.

An 837P carries the billing provider's certifications, so we get a one-tap provider authorization (magic link) before filing electronically under a provider's NPI. Without it, the patient files the payer's member claim form (the MVP's existing packet path).

## Non-assigned claims (Accept Assignment = No)

Coded as CLM07 = C ("Not Assigned"), CLM08 = N; Box 13 blank. Payer pays the patient and mails the patient an EOB + check. Commercial payers have no uniform rule on whether the provider gets any remit; where one is produced it shows $0 provider payment with the allowed amount under PR codes. Medicare sends an informational RA with remark MA28. In-network providers are paid per contract regardless of Box 27, so only true OON claims behave this way; some payers reject or re-route non-assigned claims by policy — expect payer-specific exceptions in the playbook.

## Ranking

| Rank | Vendor | Why | Main risk |
|---|---|---|---|
| 1 | Stedi | Self-serve, no setup fee, no monthly minimum (dropped mid-2026), prepaid credits from $25. Published tiered pricing: 837 $0.30 → $0.10 at 10k+/mo; 270/271 and 276/277 $0.30 → $0.08; 835 $0.20 → $0.08; paper $1 + $0.20/page. JSON 837P with explicit `planParticipationCode` / `benefitsAssignmentCertificationIndicator`. 277CA + real-time 276/277. Unlimited providers and enrollments, no per-provider fee; Stedi signs enrollment PDFs where allowed. Onboarding in hours; enrollments 24–48h typical. G2 4.9; $70M B (9/2025) + $50M C. | Single-rail dependency on a fast-moving API; Medicare enrollment still needs the provider's own signature. Volume discounts start at 500+/2,500+ claims/mo. |
| 2 | Claim.MD | Cheapest full clearinghouse: Basic $25/mo + $0.30 per claim/ERA/eligibility ($100 setup) or Unlimited $100/mo. Free test account, no contract. Real 835/277/270 endpoints. | Form-POST/XML-first legacy API; **$25/mo per additional billing-provider Tax ID** on Unlimited — wrong shape for hundreds of one-off providers. 11–50 staff. |
| 3 | Optum (Change) Medical Network APIs; Availity as alternate if BCBS-heavy | Largest payer network; JSON APIs incl. 277CA/835 pickup; official test indicator. | Contract-gated production, no published pricing, grade-C dev experience, 2024 outage history; weeks-to-months sales cycle. Availity's remittance API is still beta and equally gated. |

## Ruled out

Office Ally ($44.95/mo per Tax ID + rendering NPI combo if any non-par claim is sent that month — catastrophic for our model); Waystar and TriZetto (enterprise, per-provider pricing, no self-serve API); Candid Health (3% of collections — meaningless when the payer pays the patient); Apex EDI/Ensora and Therabill (EHR-embedded, quote-based, no API docs); pVerify (eligibility + status only, no 837, $495–950 onboarding); Eligible.com (unverifiable, no activity since 2024); Infinedi, Etactics, Assertus (not developer products). ClaimRev is a small API-first entrant worth a call as a second backup.

## Payer enrollment matrix

| Transaction | Enrollment needed? |
|---|---|
| 270/271 | Usually no; Medicare needs a short per-NPI attestation |
| 837P | Usually no for commercial; yes for Medicare (provider signs), most Medicaid, some Blues; non-exclusive |
| 277CA | No |
| 276/277 | Usually no; independent of remittance enrollment |
| 835 | Always yes, per provider per payer, exclusive; 24–48h to 30 days |

## Sources
stedi.com/pricing; stedi.com/docs/healthcare (submit-professional-claims, supported-payers, transaction-enrollment, claim-responses-overview, billing, api-reference/post-healthcare-claims); revcycleai.com on Stedi pay-as-you-go (6/2026); claim.md/pricing.html; api.claim.md; docs.claim.md test-account guide; developer.availity.com API guide (3/2025); developer.optum.com eligibilityandclaims docs and FAQ; marketplace.optum.com pricing; cms.officeally.com/products/pricing; pverify.com/pricing; docs.joincandidhealth.com; supergood.ai API report cards (Optum, Waystar); CMS Claims Processing Manual ch. 22 (RA, MA28); Noridian CEDI and SPR field descriptions; simplepractice.com "how to bill out of network"; pabau.com Claim.MD vs Office Ally; developer.claimrev.com.
