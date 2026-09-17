# Medicare submission feature — feasibility (2026-09-16)

## Bottom line
The superbill→insurer model mostly does not work for Original Medicare. It does work for Medicare Advantage PPOs, and the follow-up/appeal engine is the real Medicare opportunity.

## Rules that decide this
- Mandatory claim submission (SSA §1848(g)(4)): every enrolled provider — participating AND non-participating — must file the claim for covered services, cannot charge for filing, penalty up to $2,000/violation. So the "patient files from a superbill" case for Original Medicare only arises when a provider fails/refuses to file.
- Opt-out providers (private contract): Medicare pays nothing, Medigap pays nothing, MA plans may not pay (42 CFR 422.220, except emergencies). Superbill is worthless. This is most cash-pay therapists/psychiatrists/direct-care docs who see Medicare patients.
- Beneficiary self-filing = CMS-1490S, mail only to the MAC, itemized bill attached, 12-month filing limit, ~60 days processing.
- MFT/MHC became Medicare-eligible Jan 2024; they now must enroll or opt out to see beneficiaries. Cash-pay therapists' Medicare clients are therefore mostly under opt-out → no reimbursement.
- Medicare Advantage: 35.2M enrollees (55% of eligible) in 2026; ~40% in PPOs with OON benefits. MA PPO OON claims from a non-opted-out provider are a normal member reimbursement claim (plan's own form), same shape as commercial OON.
- Appeals: Original Medicare redetermination within 120 days of MSN, then reconsideration (QIC) 180 days, ALJ, Council, court. MA: plan reconsideration (~65 days) → IRE → ALJ. Fully form/deadline driven — fits the follow-up engine.

## Who does what
- Mentaya: excludes traditional Medicare, Medicaid, HMOs.
- Reimbursify: supports Medicare Advantage; excludes Traditional Medicare, Medicaid, HMOs, some EPOs, workers comp.
- Thrizer: no public statement found; assume same as Mentaya.
- Counterforce Health: free AI denial-appeal generator for patients + clinics; payer-agnostic.
- Muni Health / Hathr.ai: provider-side AI appeal tools including Medicare.
- No one found doing patient-side CMS-1490S filing or Original Medicare appeal automation for consumers.

## Opportunities (ranked)
1. Medicare Advantage PPO OON claims — add plan-type detection + MA plan reimbursement forms. Low lift, Reimbursify already does it, table stakes.
2. Provider-status gate — check NPI/opt-out status (CMS opt-out affidavit list is public) before generating a packet; tell the patient upfront "this provider opted out, no payer will reimburse." Prevents wasted submissions; differentiator.
3. Appeals/follow-up for Medicare denials (Original + MA) — deadline tracking, redetermination form (CMS-20027), MA reconsideration letters. Underserved on the consumer side.
4. CMS-1490S packet generator for the narrow "provider didn't file" case (non-enrolled/refusing provider, foreign travel, DME). Small but zero competition.
5. Claim-status automation via Blue Button 2.0 (Original Medicare) and MA Patient Access FHIR APIs — auto-detect paid/denied, trigger follow-ups. Strong differentiator vs. mail-and-wait.

## Threats
- Regulatory: any packet that makes an opt-out provider's superbill look claimable is a compliance problem for the provider (private contract violation) and the patient.
- Market shrinkage: MA enrollment expected to plateau/shrink in 2026; PPO share still rising.
- Incumbents can add MA/appeals quickly.
- Medicare-eligible users are older; UX and trust bar is higher; PHI + Medicare Beneficiary Identifier handling.
- No API for CMS-1490S; still mail-only.
