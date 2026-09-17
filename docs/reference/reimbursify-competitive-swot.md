# Reimbursify — Reverse-Engineering & SWOT (2026-09-16)

## What Reimbursify actually is

Reimbursify LLC (New York; founded 2016–2017 by Vatsal Thakkar, M.D., an NYU-affiliated psychiatrist who is Founder/President/CMO, and William Brown, Co-Founder/COO; consumer app launched May 2018 at the APA Annual Meeting) is the **oldest and only remaining patient-direct out-of-network claim filer** in the category. Bootstrapped ($0 raised per Latka/Tracxn), ~4 employees, ~$440K ARR as of Sept 2025 (Latka; LeadIQ's $1–10M band is a generic estimate). Stack per LeadIQ: AWS, WordPress, Zendesk, HubSpot, Hotjar, Google Ads — i.e., a small-team SaaS, not a fintech.

The model is two-sided but the *unit* is the claim, not the payment. Patients photograph a superbill and file from the app; practitioners can optionally pay a flat monthly fee so their clients file free and the practice can file "courtesy claims" and run benefit checks. Reimbursify never touches the money: reimbursement goes from payer to patient by EOB + paper check, and Reimbursify "NEVER takes a percentage of your reimbursement."

Claimed scale: 10,000+ practitioners, 100,000+ claims filed (note: the Thrizer doc's "100M+" was a transcription error — it's 100K claims), <60-second average filing time, 80% reimbursement rate (cited as an Aetna PPO sample), ~12-day sample turnaround, "$8,640 additional annual revenue per practice." Target specialties listed: mental health, PT, SLP, dietitians, psychiatry, lactation, naturopathic, pediatric, fertility.

### Architecture (observed + inferred)
- Surfaces: consumer mobile app (iOS 4.2★/600 ratings, v52 shipped this week; Android 3.9★/153 reviews, 10K+ installs, updated Aug 7 2026), web Practice Portal, two embeddable widgets (VeriFAST = benefits check on the practice website; FileFAST = claim-filing button), and a Claim Submission API for EHR/telehealth partners.
- Claim flow: patient/practice enters visit data (provider search auto-populates NPI/tax ID; "patent-pending" claim engine checks CPT/ICD errors pre-submission) → "digitized process" delivers to "insurance processing hubs within hours" (inferred clearinghouse; never named) → payer adjudicates 1–2 weeks typical, 4–6 weeks stated → patient gets EOB and check by mail. 2-hour cancel window with account credit; unlimited free resubmits with edited codes (DOS, provider, patient locked). Claim cloning for recurring visits.
- **Status tracking is manual.** The app asks users to "update claim status by entering deductible/reimbursement amounts" from their EOB. No evidence of 277 claim-status or 835/ERA ingestion. This is the single biggest product gap.
- Claims are filed "paid in full to practitioner, reimburse patient"; Reimbursify documents the recurring assignment-of-benefits failure where payers send the check to the provider anyway and tells the patient to call the insurer.
- Payer coverage: commercial only. Explicitly excludes Medicare, Medicaid, TRICARE, workers' comp, disability. Maintains an Availity non-par registration guide (24 hrs–3 weeks approval + 2–3 weeks propagation) because "more and more carriers" require it — same manual burden Thrizer carries.
- Integrations: IntakeQ (documented, opt-in at intake triggers claim; legacy pricing was a $250/yr add-on), Zencare (member discount + help-center article), Practice PRO-gated API. No SimplePractice, TherapyNotes, or Jane integration found. Partner page is a recruitment page, not a logo wall. Small-practice partnerships announced (Evergreen Therapy Collective, Jul 2026; Kentucky Therapy Solutions; Child Mind Institute; MoodMonitor).
- Support: email (hello@ / practitioners@) on Zendesk; site claims a "dedicated customer care team works directly with your patients to troubleshoot outstanding claims," but the help center's rejection article says Reimbursify has "no influence or control over how an insurance company finalizes a claim" and documents no appeal or follow-up process.

### Pricing (as of Sept 2026)
- Patients: first claim free, then $3.99/claim or $29.99/10-pack; $0 if their practitioner is on Plus/Pro.
- Practitioners: Basic $0 (clients pay per claim; summary portal); Plus $59/mo (10 courtesy claims + 4 benefit checks/mo, widget, full portal); Pro $99/mo or $89/mo annual (unlimited claims + VOB, API/EHR, priority support; "Most Popular"); group pricing at 3+ practitioners; no contracts, no card for trial.
- Their own comparison math: Pro at 20 clients/wk × $200 = $0.68–$1.15 per session to the practice and $0 to clients, vs. $14–$26/session to clients on Thrizer/Mentaya; Basic maxes around $279/mo (clients) vs. $860/mo on the percentage models. This flat-fee framing is their entire competitive argument.

### Unit economics (reconstructed)
A solo practice on Pro pays $1,068–1,188/yr regardless of volume, so Reimbursify's revenue per practice is capped and does not scale with session count — which is why 10,000 "practitioners" (mostly free Basic accounts with patients paying per claim) yields ~$440K ARR. At $3.99/claim gross with a clearinghouse cost likely $0.25–0.50 per transaction, per-claim gross margin is high but absolute dollars are tiny; the business needs volume, and volume in the patient-direct lane is gated by manual data entry and denial friction.

---

## STRENGTHS
1. Only patient-direct player left standing. After Thrizer retired superbill upload (Aug 9 2026), Reimbursify is the sole app where a patient whose provider is on *nothing* can still file. Every "how do I file a superbill" SEO query and every therapist referral for DIY clients now routes here by default.
2. Lowest, flattest pricing in the category and no money movement. $3.99/claim or $99/mo unlimited vs. 3% + 5% percentage models; no forced payment-rail switch; no float; practitioners don't hand over card processing. Independent reviewers (Mentaya, Well Culture Counseling) concede it is the low-cost option.
3. Native mobile apps on both platforms, actively shipped (v52 this week; Android updated Aug 2026), with a real install base (10K+ Android, 600+ iOS ratings). Nobody else in OON has a consumer app with this footprint.
4. Multi-specialty from day one. PT, dietitians, SLP, fertility, naturopathic — the specialties Thrizer/Mentaya ignore and Headway/Alma can't serve.
5. Practice-side product is more complete than its reputation: courtesy claims, real-time VOB, two embeddable widgets, an API, IntakeQ integration, group pricing, and the Zencare channel. The "$8,640/yr additional revenue + 50% more first appointments" pitch gives practices a reason to pay even though the patient could self-file.
6. Founder credibility with the buyer. A practicing NYU psychiatrist selling to psychiatrists/therapists; launched at APA; podcast/CE circuit presence since 2018. Eight years of payer-quirk knowledge (Availity, AOB failures, BCBS registration) baked into the help center.
7. Pre-submission claim scrubbing (CPT/ICD checks, provider auto-populate, clone claim, 2-hour cancel, free resubmits) reduces the dumb rejections that kill self-filed paper claims.

## WEAKNESSES
1. No post-submission loop. Status is self-reported from a mailed EOB; there is no automated claim-status inquiry, no ERA ingestion, no appeal workflow, no denial concierge, and no success guarantee. Mentaya's line — "doesn't reduce the administrative burden that causes most clients to give up on reimbursement" — is accurate. Reviews echo it: "does nothing for you that you can't do for yourself" (Trustpilot, Nov 2023), "paid months ago and received zero help" (Play Store, Jul 30 2026), "claims filed incorrectly… no responsibility" (Jul 2025).
2. Support does not scale with 4 people. Email-only; multiple reviews across 2020–2026 cite unanswered emails and year-long unresolved claims. The "dedicated customer care team" claim on the marketing site is contradicted by the help center's disclaimer.
3. Data entry is still the product. "Under 60 seconds" is fast only for a recurring, cloned claim from a known provider; first-time setup requires insurance card photos, provider lookup, and code entry. No evidence of vision/OCR extraction from an arbitrary superbill PDF.
4. Revenue model is capped and tiny. Flat fees + free tier produce ~$440K ARR on 10,000 practitioners (~$44/practitioner/yr). No capital to build the follow-up engine or integrations that would fix weakness #1; Latka's 2025 figure implies eight years to reach sub-$1M.
5. Distribution is thin. No SimplePractice/TherapyNotes/Jane integration despite "EHR integration" on the pricing page; IntakeQ is the only documented one. Partner page is aspirational. The Zencare deal is a discount, not embedded filing.
6. Rating erosion on the consumer surface: Android 3.9★ and recent 1-star reviews on the exact failure mode (paid, stuck, no help). For a product acquired via app-store search, this compounds.
7. Same payer exclusions and manual registration burden as everyone else: no Medicare/Medicaid/TRICARE; practitioners must self-register on Availity; paper-check reimbursement and AOB misdirection are documented as "rare" but are the reviews' top complaint.
8. Team/key-person concentration: LeadIQ shows 0–1 employees, one AE, one growth advisor; the founder still runs a clinical practice. Bus factor of one.
9. Brand confusion: "practitioner privacy focus" and "patent-pending" are used as differentiators but never substantiated; the "80% reimbursement rate" is a single-payer sample, not a book-wide metric.

## OPPORTUNITIES
1. Absorb Thrizer's abandoned patients. Thrizer told clients whose therapists aren't on Thrizer to "file with the carrier themselves" — a warm, motivated cohort with existing superbills and no tool. Cheap SEO/paid capture right now.
2. Automate the loop they already own the front door to: 276/277 status, ERA parsing, denial-reason mapping, auto-appeal letters, payer-complaint escalation. This turns $3.99/claim into a $10–15 "we get you paid" product and fixes the top review complaint.
3. Embedded/API distribution to telehealth and DTC health (fertility, GLP-1/nutrition, pediatric therapy, functional medicine) where every patient is OON by design and the vendor wants a "we help you get reimbursed" checkbox.
4. Group-practice and association channel: $99 unlimited is already priced for groups; professional-association member deals (APA, AND, APTA private-practice sections) would move thousands of practitioners at once.
5. Same macro tailwinds as Thrizer: private-pay migration (34% of psychologists take no insurance; $157 private vs $111 in-network rates), DOL keeping network adequacy as a MHPAEA enforcement priority (FAB 2026-03), employer high-deductible plan growth making OON benefit verification a sales tool for practices.
6. Data asset: eight years of payer × plan × CPT × outcome data across every specialty — the raw material for a real reimbursement estimator and for payer-specific auto-fix rules, if they ever productize it.
7. An acquisition exit. A directory (Zencare, Psychology Today), an EHR (IntakeQ's parent, Jane, Carepatron), or a private-pay platform (Heard, Mentaya) could buy the consumer app and install base for less than it would cost to rebuild.

## THREATS
1. AI-native patient-direct entrants (this is Ryan's lane). A product that extracts any superbill with vision, files electronically, and *owns follow-up* attacks Reimbursify's only remaining moat — being the default DIY tool — with a better answer to every 1-star review. Reimbursify has neither the capital nor the headcount to respond quickly.
2. EHRs make the practice tier redundant. SimplePractice courtesy claims (electronic, Accept Assignment = No) and superbill generation are free; Mentaya is shipping a free EHR; if TherapyNotes/Jane add OON claim filing, the $59–99/mo tier loses its reason to exist and Reimbursify is back to $3.99/claim from patients.
3. Mentaya's guarantee + concierge and Thrizer's instant-reimbursement affordability lever both make Reimbursify look like "the cheap one that doesn't help," which is exactly how two of the three independent comparisons frame it. Percentage pricing feels expensive to therapists but *free* to clients at point of sale.
4. Payer hardening: mandatory non-par registration, paper-check-only policies, reference-based OON pricing, AI-driven denials. Every one of these lands on the patient with Reimbursify, because Reimbursify has no follow-up function to absorb it — and the patient blames the app.
5. Consumer-app economics: iOS/Android review decay, platform fees on in-app purchases (Apple's 15–30% on $3.99 claims unless routed to web), and rising CAC for "superbill" keywords as Thrizer/Mentaya/EHRs bid on them.
6. Regulatory/compliance exposure for a 4-person team handling PHI with no disclosed SOC 2 and a WordPress front end; one breach ends the company.
7. Founder/key-person and stagnation risk: bootstrapped since 2016, sub-$1M revenue, founder still practicing — the company may simply not grow, leaving a stale default in the market until someone replaces it.

## Implications for Ryan's superbill-claims product
- Reimbursify is the direct competitor, not Thrizer or Mentaya. It defines the price anchor ($3.99/claim, $29.99/10, first free) and the baseline feature set (photo superbill, provider auto-fill, code scrubbing, clone claim, free resubmit, 2-hour cancel). The MVP must match that baseline on day one or it will lose the "file my superbill" search.
- Win on the loop, not the form. Reimbursify's status tracking is *manual from a mailed EOB*. Automated status (277), ERA-based reconciliation, denial-reason explanation, one-tap appeal/escalation, and proactive nudges ("Cigna has had this 31 days — send the follow-up?") are the whole differentiation and the justification for a higher price. Every negative review of Reimbursify is a spec for this feature.
- Vision extraction from *any* superbill (PDF, EHR printout, handwritten receipt) beats their form-driven entry; pair it with NPPES/NPI lookup so provider fields auto-fill better than theirs.
- Price above them, not below. $3.99 is the "submit and pray" price. Charge a flat per-claim fee in the $8–15 range or a $12–20/mo subscription that includes follow-up; avoid percentage-of-reimbursement (Reimbursify's "we never take a percentage" is a real trust point with patients) and avoid floating money.
- Copy their practice-side wedge later, not now: courtesy filing + VOB widget + flat $99 unlimited is how they get practices to subsidize patients. A patient-first MVP can add a "your provider can sponsor your claims" tier once the loop works.
- Same scope exclusions apply: no Medicare/Medicaid/TRICARE; require Availity non-par registration prompts for the provider when a payer demands it, and handle the assignment-of-benefits misdirection case explicitly (they document it as "rare"; reviews say otherwise).
- Distribution gaps to exploit: Reimbursify has no SimplePractice/TherapyNotes/Jane integration and only a discount deal with Zencare; the telehealth/DTC embedded lane (fertility, nutrition, pediatric therapy) is open.

### Sources
- reimbursify.com (home, practitioners, practice-pricing, why-reimbursify, about-us, partners, partner-with-us, zencare-reimbursify)
- support.reimbursify.com (patient pricing, what-is-Reimbursify, processing time, fix-a-claim, rejections, EHR integration, Availity registration, AOB misdirection)
- Apple App Store and Google Play listings (Sept 2026); Trustpilot (41 reviews, 4.3★)
- PRNewswire launch release (May 7 2018); Jason Duprat podcast #127 (Oct 2020)
- Latka company profile (ARR/headcount, Sept 2025); LeadIQ profile (Jul 2026); Tracxn
- Mentaya, "Mentaya vs. Thrizer vs. Reimbursify" (Apr 16 2026); IntakeQ integration guide; Zencare help center
