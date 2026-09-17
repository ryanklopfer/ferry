# Thrizer — Reverse-Engineering & SWOT (2026-09-16)

## What Thrizer actually is

Thrizer (Thrizer Inc., founded ~2021–2022, Raunak Sharma CEO + Sanjana Sathya Sharma, husband-and-wife, self-described "no institutional funding to date"; Crunchbase says 1–10 employees, About page lists a 7-person leadership team incl. a Director of RCM; addresses in CA (marketing), SF (Crunchbase), Rockville MD (BBB)) has repositioned from "superbill reimbursement app for patients" to **"the payment platform for private-pay practices."** The wedge is: the therapist runs card/HSA/FSA charges through Thrizer, and every charge automatically becomes a CMS-1500 out-of-network claim filed on the client's behalf. Claimed scale: 2,500+ practitioners, $25M+ annual payments processed, $5M+ annual client reimbursements.

### Architecture (observed + inferred)
- Three surfaces: clinician portal (clinician.thrizer.com / app.thrizer.com), client portal (client.thrizer.com), embeddable Benefits Widget for provider websites. No native mobile app found; no EHR integrations.
- Money flow: provider charges client → Thrizer collects (3% Basic; 2.6% + $0.25 on the "coming soon" $39/mo Gold tier) → payout 2–3 business days (next-day on Gold).
- Claims flow: charge + ICD-10 + CPT/duration/place-of-service → electronic CMS-1500 to payer (inferred clearinghouse). Reimbursement goes to client as direct deposit (1% fee) or paper check (free). 4–6 week typical cycle per Thrizer's own materials.
- Instant Reimbursement (fka Thrizer Pay/ThrizerPlus): client pays only estimated coinsurance; Thrizer floats the insurer's share ("a real-time micro loan"), charges the client 5% of the reimbursement, and carries denial risk. Only available after deductible is met AND at least one prior successful claim exists on that plan (calibration). Thrizer "does not reverse the clinician's payout because of that claim outcome."
- Eligibility/benefit checks: real-time deductible status + estimated reimbursement (inferred 270/271 eligibility API vendor). Heavy disclaimers: estimates, not guarantees.
- Payer coverage: commercial PPO/BCBS only. Explicitly NOT Medicare, Medicare Advantage, Medicaid. Commercial HMOs generally have no OON benefit. Anthem/Elevance requires non-par provider registration via Availity and pays by paper check only; Thrizer maintains ~18 separate BCBS-plan registration guides — evidence the payer side is manual and brittle.
- **Key 2026 change:** as of Aug 9, 2026 Thrizer retired client superbill upload and manual claim entry. "Thrizer does not accept client-submitted superbills through any channel." Patients whose therapist isn't on Thrizer are told to file with the carrier themselves.

### Unit economics (reconstructed)
For a $200 session, post-deductible, 70% allowed: provider pays ~$6 (3%); client on direct deposit pays ~$1.40 (1% of $140); client on Instant pays ~$7 (5% of $140). On a full-time caseload (~100 sessions/mo) Thrizer grosses roughly $600/mo from the provider plus $140–$700 from clients. Reimbursify's comparison pegs the client-side max at ~$860/mo vs. its own ~$279. Float exposure per Instant client: ~$140 × 4–6 weeks, compounding across the book with no institutional capital disclosed.

---

## STRENGTHS
1. Payments-first wedge = zero-effort claims. Claim data is captured at the moment of charge, so submission is a byproduct, not a task. Founder-reported 75–80% reimbursement rate; podcast claim of dedicated payer contact lines.
2. Client affordability lever nobody else matches. Instant Reimbursement turns a $200 OON session into a ~$60 out-of-pocket charge at time of service. This is the emotional pitch in every testimonial ("dramatically reduces the cost of therapy").
3. Clinician payout protection. No clawbacks from claim outcomes — a real differentiator vs. in-network billing trauma (APA: 52% of therapists leaving networks cite payment delays/clawbacks).
4. Free-to-provider entry, no contracts, unlimited seats, free Benefits Widget (Mentaya charges $29–39/mo; Reimbursify $59–99/mo for the equivalent). Low-friction land motion for solo and group practices.
5. Tailwinds they created content for: Thrizer's own annual survey (with Beacon Media) is widely cited (34% financial, 26% admin burden as reasons for going OON), giving them SEO/thought-leadership authority.
6. Vertical focus and HIPAA/BAA posture; in-house RCM leadership suggests they actually work denials.
7. Bootstrapped discipline: no VC means no pressure to blow up pricing or pivot away from therapists.

## WEAKNESSES
1. Forced payment-rail switch. Core OON automation only works if the practice moves card processing to Thrizer. Practices on SimplePractice/TherapyNotes/Stripe must run two systems or double-enter. Independent reviewers (Mentaya's comparison, mytherapist.tools) flag this as the #1 objection.
2. No EHR integrations, no mobile app, email-only support. For a "payment platform" this is a thin product surface; sessions/diagnoses must be re-keyed.
3. Pricing complexity. Three client outcomes (free pre-deductible / 1% direct deposit / 5% Instant) plus provider 3% plus a "coming soon" Gold tier with fees "to be announced." Competitors call it "genuinely confusing"; Reimbursify frames it as "nickel & dime."
4. Instant Reimbursement is narrow in practice: requires met OON deductible + a prior successful claim + supported plan + usable benefit check. Most new clients in January are ineligible; Anthem pays by paper check only. The headline feature is conditional.
5. Payer dependency and manual registration burden. 18+ BCBS-specific registration guides, Availity enrollment, delays if incomplete. Explicit exclusion of Medicare/Medicaid (~35–40% of US covered lives) and HMOs.
6. Balance-sheet risk. Floating reimbursements at 5% for 4–6 weeks is a lending business run without disclosed capital; a denial wave or a payer policy change hits Thrizer directly. Thrizer already declines to guarantee outcomes, while Mentaya offers a 100% fee refund guarantee.
7. Thin trust signals. Zero reviews on Slashdot/Capterra-type sites, BBB C+ (one unanswered complaint, not accredited), small team (1–10 per Crunchbase), inconsistent addresses (CA / SF / Rockville MD).
8. Abandoned the patient-direct lane. Retiring superbill upload (Aug 2026) shrinks their TAM to "clients of Thrizer therapists" and removes the consumer acquisition channel. It also signals that OCR/manual-claim ops were unprofitable at their fee levels.
9. Support scale: "help@" email only; no phone; no SLA. Group practices with 20 clinicians will feel this.

## OPPORTUNITIES
1. Macro shift to private pay. 34% of psychologists take no insurance (APA 2024); Thrizer's own data says 92% of clinicians are fully or partly private pay. Private-pay rate ($157–159) vs in-network ($111–112) is a 36% gap — OON automation is how therapists keep the higher rate without losing insured clients.
2. Parity enforcement on network adequacy. DOL FAB 2026-03 (Sept 8, 2026) narrowed MHPAEA enforcement but kept network adequacy as a priority and told plans to protect members from OON costs caused by thin networks — a lever for higher OON allowed amounts / single-case agreements.
3. Gold tier + next-day funding + embedded finance (instant payouts, practice loans, HSA/FSA card issuing) — natural expansion once they own the payment rail.
4. Adjacent verticals: dietitians, PT/OT, speech, chiropractic, psychiatry, functional medicine — all superbill-heavy, all excluded from Headway/Alma-style in-network aggregators.
5. Group practice / RCM upsell: role-based permissions and unlimited seats are already built; a managed "OON billing service" tier for groups at 5–8% would compete with human billers.
6. Distribution partnerships: EHR marketplaces (SimplePractice, TherapyNotes, Jane), directories (Psychology Today, Zencare), therapist accountants (Heard).
7. Data moat: 2,500 practices × payer × plan × CPT = a proprietary OON allowed-amount dataset — the basis for a real (not estimated) reimbursement prediction product and for pricing Instant Reimbursement risk.

## THREATS
1. EHRs eat the feature. SimplePractice already supports OON "courtesy claims" (electronic, Accept Assignment = No) at no extra charge and generates superbills; Mentaya is shipping a free EHR. If SimplePractice adds Instant-style client financing, Thrizer's forced-switch model collapses.
2. Mentaya's fee-free-to-therapist model + claims guarantee + concierge support wins the "hands-off" segment, and it's VC-backed (Pear VC, Banana Capital). Reimbursify (100M+ in claims filed, native mobile app, flat pricing) wins the DIY-client segment.
3. Payer countermeasures: reference-based OON pricing, tightening non-par registration, paper-check-only policies (Anthem), and plans dropping OON benefits altogether shrink the reimbursable pool. Payer AI denial systems raise Thrizer's float losses.
4. Regulatory drift: the Sept 2026 DOL non-enforcement of the 2024 parity rule's data/"meaningful benefits" provisions reduces pressure on plans to improve OON reimbursement. State-level rules on third-party claim submitters and lending/BNPL classification of "float" products are a latent risk.
5. Card-network and processor economics: Thrizer's 3% is a markup on ~2.9% + $0.30 interchange; Gold at 2.6% + $0.25 is near cost. Margin depends on client-side fees, which competitors are racing to zero.
6. Trust/PHI incident risk with a small team and no disclosed SOC 2. One breach or a viral denial story in the therapist Facebook groups (where their reputation lives) would be disproportionately damaging.
7. Founder/key-person and capital risk: bootstrapped, small, running a float book — a payer delay of even two weeks across the book is a liquidity event.

## Implications for Ryan's superbill-claims product
- Thrizer just vacated the patient-direct superbill upload market (Aug 2026). That is exactly the lane the MVP occupies — and nobody in the category serves patients whose provider is NOT on a platform, except Reimbursify at $3.99/claim (manual entry, no follow-up automation).
- Differentiate on what Thrizer can't structurally do: work with any provider's superbill (vision extraction), any specialty (not just therapy), and own the post-submission loop (status inquiries, escalation, appeals, regulator complaints) — the follow-up engine is the moat; Thrizer's "email support and hope" is the gap.
- Avoid their two traps: don't front money (float risk), and don't force a payment-rail switch. Charge the patient a flat per-claim or subscription fee, or a small success fee capped in dollars.
- Copy their good ideas: real-time eligibility/deductible check before submission, payer-specific playbooks (their BCBS registration library is essentially a public payer-quirks database), and CMS-1500 electronic submission via a clearinghouse rather than fax/mail.
- Medicare/Medicaid/HMO exclusions apply to you too — scope them out explicitly in onboarding.
