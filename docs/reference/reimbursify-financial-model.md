# Reimbursify — Reverse-Engineered Financial Model (2026-09-16)

Companion to `reimbursify-competitive-swot.md`. Everything below is reconstructed from public data; Reimbursify is a private, bootstrapped LLC and publishes no financials. Hard facts are marked as such; everything else is an estimate with the assumption stated.

## 1. Hard data points

| Fact | Value | Source |
|---|---|---|
| Revenue | ~$440K ARR, Sept 2025 (Latka *estimate*, likely headcount-derived) | Latka |
| Capital raised | $0, bootstrapped since 2017 | Latka, Tracxn |
| Headcount | 4 (Latka); LeadIQ shows 1–3 named people: a Growth Advisor, an Account Executive, one other. Founder still runs a psychiatric practice. | Latka, LeadIQ |
| Cumulative volume | "100,000+ claims filed" since May 2018 launch | reimbursify.com |
| Practitioner base | "10,000+" on marketing pages, "thousands" on the practitioner page, "tens of thousands of patients" on careers page | reimbursify.com |
| Patient price | 1st claim free, then $3.99/claim or $29.99/10 ($3.00 effective); a reviewer cites "$2 per claim" via volume pack, so cheaper packs have existed | support.reimbursify.com, App Store review |
| Practice list price | Basic $0; Plus $59/mo; Pro $99/mo or $89/mo annual; custom group pricing at 3+ practitioners; no contracts | practice-pricing page |
| Practice promo price (Jul 2024) | Plus $39/mo ($35 annual); Pro $69/mo ($62 annual) — 30–35% off list | practice-pricing-july2024 page |
| Channel price (Zencare "Private Pay Booster") | Professional +$29/mo (= Plus: 10 courtesy claims + 4 VOB/mo); Premium +$59/mo (= Pro: unlimited). Billed by Zencare, not Reimbursify. Free Zencare members get 5 VOBs total. | therapist.zencare.co feature comparison |
| Legacy integration price | IntakeQ add-on was ~$250/yr | IntakeQ support (per SWOT doc) |
| Payment rail | No in-app purchases listed on the App Store; claims are purchased with a card, i.e. Stripe-style processing rather than Apple/Google IAP | App Store listing |
| Money movement | None. Payer mails EOB + check to patient. "NEVER takes a percentage." | support.reimbursify.com |
| Stack | AWS, WordPress, Freshdesk-style help center, HubSpot, Hotjar, Google Ads | LeadIQ |
| Address | Now Westport, CT (Play Store), previously NYC | Google Play |

## 2. How the money actually flows

Reimbursify has four revenue streams, and the one they market (patient per-claim) is the smallest.

**Stream A — Patient micro-transactions.** $3.99/claim or $3.00 in a 10-pack, minus the first free claim, minus claims sponsored by a Plus/Pro practice, minus promo codes. Of the ~20–30K claims/yr the platform likely processes now, only a fraction are patient-paid. Base case: ~12K paid claims × ~$3.30 blended = **~$40K/yr, roughly 9% of revenue.** This stream exists to feed the practice funnel, not to make money.

**Stream B — Direct practice subscriptions (Pro).** The real business. Pro at $89–99 list, but after annual discounts, group pricing, and periodic 30% promos the effective ARPU is closer to **$75–85/mo**. Base case ~250 direct Pro seats → **~$240K/yr (55%).**

**Stream C — Direct practice subscriptions (Plus).** $59 list, ~$50 effective. Base case ~120 seats → **~$70K/yr (16%).**

**Stream D — Channel (Zencare and similar).** Zencare resells the exact Plus/Pro feature set at $29/$59 and bills it themselves. Reimbursify's wholesale take is unknown; assume they net $20–40/seat/mo. Base case ~250 seats × ~$30 → **~$90K/yr (20%).**

Reconciliation: 250 + 120 + 250 = **~620 paying practitioner seats out of "10,000+"** — a ~6% paid conversion — plus ~12K paid patient claims lands almost exactly on Latka's $440K. Low/high scenarios (400 seats + 8K claims; 930 seats + 20K claims) bracket **$270K–$680K**. I'd treat true revenue as $350–500K.

Key structural point: **revenue is per-seat and flat; cost is per-transaction and variable.** A Pro practice filing 10 claims/month pays Reimbursify $8.90 per claim. The same practice filing 80 claims/month pays $1.11 per claim, and at 150 (a busy group practice on group pricing) it's under $0.60 — below what a full-service filer would even pay in processing plus support. Their "flat rate lets you grow without extra charges" is a customer benefit that is precisely a revenue cap.

## 3. Reconstructed P&L (base case, annual)

| Line | Estimate | Basis |
|---|---|---|
| Revenue | $440K | above |
| Card processing | ($12K) | 2.9% + $0.30. On a $3.99 claim the fixed $0.30 makes the effective fee **10.4%**; on the $29.99 pack 3.9%; on subscriptions ~3.3% |
| EDI / clearinghouse | ($6–10K) | 25–30K claims × $0.10–0.30 (Stedi-style per-transaction) or a Claim.MD-style unlimited plan at ~$100–300/mo + per-Tax-ID fees |
| Eligibility (270/271) | ($3–8K) | Unlimited VOB on Pro + public VeriFAST widget. $0.08–0.30 each; volume is uncapped and partly driven by prospects who never become patients |
| Hosting, SaaS tools, app store fees | ($25–40K) | AWS, HubSpot, Freshdesk, Hotjar, WordPress, Apple/Google developer accounts, HIPAA-grade backups |
| **Gross margin (technical)** | **~85–88%** | typical for a transaction-light SaaS |
| Support & ops labor | ($60–100K) | 1 FTE-equivalent. Email-only support on a product whose failure modes (stuck claims, AOB misdirection, paper checks, Availity registration) generate tickets that cost $10–15 each to handle against $3.99 of revenue |
| Engineering | ($120–200K) | 1–2 engineers or contractors maintaining iOS, Android, web portal, widgets, API, and EHR integration — v52 shipped this week, so it's actively maintained |
| Sales / growth | ($80–120K) | one AE, one growth advisor (likely part-time/equity), Google Ads on "superbill" keywords |
| Founder / exec comp | ($0–80K) | founder has clinical income; co-founder/COO unknown |
| Insurance, legal, compliance | ($15–25K) | cyber/E&O; no SOC 2 disclosed, so this is *under*-spent |
| **Total opex** | **($330K–$580K)** | |
| **Operating result** | **–$140K to +$110K; most likely ±$50K** | |

**Verdict on profitability: roughly breakeven, sustained by the founder's outside income and a very low cost base.** Eight years bootstrapped with no raise and no layoff announcements means they are not burning meaningfully — but $440K after eight years also means they cannot fund the follow-up engine, integrations, or support staff that every negative review demands. Fully-loaded gross margin (technical COGS + support labor) is more like **60–70%**, and that is the number that matters, because support is a true cost-of-revenue for a claims product.

## 4. Where the money leaks

1. **The $3.99 price point is below its own transaction cost floor.** Processing ($0.42) + EDI ($0.25) + amortized app maintenance leaves maybe $3 of contribution — and a single support email on that claim wipes it out. Reviews show exactly this pattern ("paid months ago, zero help," "still waiting one year on one claim"). Every unhappy patient-paid claim is margin-negative.

2. **Unlimited VOB and courtesy claims on a fixed $89–99 seat.** Eligibility checks and claims are variable costs. The VeriFAST widget lets *anyone visiting a practice website* trigger a 270/271 on Reimbursify's dime. There is no metering, no overage, and no upsell above Pro. Heavy users are subsidized by light users, and the heaviest users (groups) get the deepest discount.

3. **List price is fiction; effective price is 40–60% lower.** July 2024 promo: $39/$69. Zencare channel: $29/$59, permanently, billed by Zencare, who keeps a cut. Group pricing: custom (i.e., lower). A therapist who can get Pro-equivalent for $59 via a directory they already pay for will never pay $99 direct. The channel that gives them distribution also caps their ARPU and hands the customer relationship to Zencare.

4. **A 6% paid conversion on the practitioner base.** ~9,400 of "10,000+" practitioners are on Basic: free to the practice, patients pay $3.99, and the practice still generates onboarding, portal, and support load. Basic is a cost center dressed as a funnel, and there is no evidence of a conversion engine (no usage-triggered upgrade, no per-claim overage to push practices to Plus).

5. **Free first claim + promo codes + unlimited free resubmits with no downstream loop.** The free claim is the CAC, but the app then asks the patient to *manually* update status from a mailed EOB. No status automation means no engagement, no second-claim prompt, no data on whether the free claim ever got paid. They pay the acquisition cost and never see the conversion event.

6. **Support is a cost they can't scale and a revenue they refuse to charge for.** Email-only, "no influence over how an insurance company finalizes a claim," no appeal workflow, no success guarantee, no paid concierge tier. Mentaya monetizes exactly this gap (guarantee + concierge inside a percentage fee). Reimbursify absorbs the tickets and sells nothing against them.

7. **Monthly, no-contract seats with a weak annual hook (10%).** Therapists' caseloads are seasonal; a 10% annual discount is not enough to lock in, so summer and December churn hits directly. No usage-based or outcome-based revenue cushions it.

8. **Consumer-app economics in decline.** Android 3.9★ with fresh 1-star reviews on the core failure mode; paid Google Ads on keywords that Thrizer, Mentaya, SimplePractice, and Headway also bid on. CAC rises while the $3.99 LTV per patient is fixed.

9. **Deferred compliance spend.** WordPress front end, no SOC 2, "data isn't encrypted" flag on the Play Store data-safety card, 1–4 people handling PHI. The cheap cost base is partly borrowed against a breach.

10. **Key-person dependency.** Founder runs a clinical practice; LeadIQ shows a single full-time employee. Any departure or health event is existential, and no acquirer pays for a team that isn't there.

## 5. Where Ryan can capitalize

**A. Price on the loop they don't own, above their floor.** Reimbursify has trained the market that filing is worth $3.99 and nothing more. Don't compete there. Charge $10–15 per claim or $12–20/month *including* automated status (276/277), ERA-based reconciliation, denial explanation, and one-tap appeal. At $12 a claim, card processing drops to ~5% (vs their 10.4%), EDI + status + ERA costs about $0.60 (Stedi pay-as-you-go), and there is $10+ of contribution to fund the support that makes the product work. Their weakness #1 is your gross margin.

**B. Convert their cost center into your revenue line.** Every ticket Reimbursify eats — stuck claim, check sent to the wrong party, denial with no explanation, Availity registration — is a paid product for you: "claim rescue." A patient with a stuck Reimbursify claim has the EOB, the claim number, and the motivation. A $15–25 "we chase it until it's resolved" offer, marketed against their own 1-star reviews and Thrizer's exit, is near-zero CAC.

**C. Meter what they give away.** Benefits verification costs $0.08–0.30 via Stedi. Reimbursify gives it away unlimited on Pro and free to prospects on the widget. You can offer a *patient-side* instant OON benefit check as the top of funnel (cost ~$0.20, conversion event: "you have $1,850 in OON benefit, file your first claim") and charge the practice per verified lead rather than per seat, which also aligns with how directories like Zencare sell.

**D. Attack the 94% who don't pay them.** ~9,400 Basic practices have clients paying $3.99 and getting no follow-up. Those practices need nothing from you except a referral link; the patient pays you for the loop. Offer practices a free "sponsored client" dashboard (claims filed, reimbursement rate, days-to-pay) that Reimbursify only provides on Plus/Pro. You get the practice's referral flow at $0 and monetize the patient at 3× Reimbursify's price.

**E. Out-wholesale them in channels.** Zencare gets Reimbursify Pro-equivalent for $59 retail and presumably $30–40 wholesale. A per-claim-with-follow-up product can offer directories, EHRs (SimplePractice, TherapyNotes, Jane — none integrated with Reimbursify), and telehealth/DTC platforms a rev-share on outcome fees instead of a flat seat, which is easier for a partner to sell ("free to you, your clients get reimbursed faster") and doesn't require the partner to bill.

**F. Use usage tiers where they use flat seats.** For group practices (their custom-priced, deepest-discounted segment), price per claim-resolved with volume breaks rather than per practitioner. Their $0.60–1.11/claim effective price at group volume is unprofitable for them once support is counted; you can profitably charge $4–6/claim *to the practice* with automation, because your cost per claim is ~$0.60 + near-zero human touch.

**G. Time it to their weakest quarter.** Consumer rating decay (Jul–Aug 2026 reviews), Thrizer's superbill retirement (Aug 9, 2026), and a v52 release cadence that shows they are shipping features, not fixing the loop. Paid capture on "reimbursify stuck claim," "reimbursify alternative," and "file superbill myself" is cheap right now and will not stay cheap if a funded EHR decides to own this.

**What not to copy:** percentage-of-reimbursement pricing (their "never takes a percentage" is a real trust point with patients), money movement/float, and the $3.99 anchor. Price above them on outcome, not below them on filing.

## 6. Assumptions to validate

- True revenue ($350–500K estimated). A cheap test: ask Zencare or a group-practice customer what wholesale/group pricing looks like; it bounds the channel line.
- Current annual claim volume (assumed 20–30K). The "100,000+" number's first appearance date would give the run-rate.
- Whether patient purchases go through Stripe or IAP (assumed Stripe from the App Store listing; if IAP, their processing leak is 15–30%, not 10%).
- Wholesale take from Zencare (assumed ~50–65% of retail).
- Headcount and comp (Latka says 4; LeadIQ says 1 plus advisors). Opex range covers both.

## Sources
- [Latka: Reimbursify $440K revenue, 4-person team](https://getlatka.com/companies/reimbursify.com)
- [LeadIQ employee directory](https://leadiq.com/c/reimbursify/5a7df85e5b0000da000ad3b0/employee-directory)
- [Reimbursify practice pricing (current)](https://reimbursify.com/practice-pricing/) · [July 2024 promo pricing](https://reimbursify.com/practice-pricing-july2024/)
- [Reimbursify practitioners page (100K claims, $8,640 ROI calc)](https://reimbursify.com/practitioners/) · [Individuals page](https://reimbursify.com/individual-page/) · [Careers page](https://reimbursify.com/careers/) · [Zencare partnership page](https://reimbursify.com/zencare-reimbursify/)
- [Reimbursify help center: What is Reimbursify (patient pricing, no-percentage policy)](https://support.reimbursify.com/support/solutions/articles/42000065413-what-is-reimbursify-) · [Claim credits](https://support.reimbursify.com/support/solutions/articles/42000086297-how-many-of-my-claim-credits-are-remaining-) · [Individuals folder (promo codes)](https://support.reimbursify.com/support/solutions/folders/42000036847/page/3)
- [Zencare Private Pay Booster feature comparison ($29/$59 tiers)](https://therapist.zencare.co/private-pay-booster-feature-comparison) · [Zencare pricing](https://therapist.zencare.co/pricing) · [Zencare Private Pay Booster page](https://therapist.zencare.co/private-pay-booster) · [Zencare help: upgrading PPB](https://help.zencare.co/hc/en-us/articles/47051540152859-How-do-I-upgrade-my-Private-Pay-Booster-account)
- [Apple App Store listing](https://apps.apple.com/us/app/reimbursify/id1243424101) · [Google Play listing](https://play.google.com/store/apps/details?id=com.reimbursify&hl=en_US) · [Trustpilot](https://www.trustpilot.com/review/reimbursify.com)
- [Mentaya vs Thrizer vs Reimbursify](https://www.mentaya.com/blog/mentaya-vs-thrizer-vs-reimbursify)
- Cost benchmarks: [Stedi pricing](https://www.stedi.com/pricing) · [Claim.MD pricing](https://www.claim.md/pricing.html)
