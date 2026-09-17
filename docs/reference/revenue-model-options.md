# Revenue Model Options — summary (2026-09-17)

Full analysis with SWOTs and charts lives in the Claude Doc "Revenue Model Options": https://claude.ai/code/artifact/bef586a8-f77b-41c8-9600-c57b67209b42. This file is the pointer plus the numbers a later session needs.

## The four models

| Model | Who pays | Fee fires | Rev / patient-yr | Contribution | Comparator |
|---|---|---|---|---|---|
| A. Pay-when-paid, $9/claim, first free, cap 10% of recovery | Patient | On payment | $110 | 58% | Reimbursify $3.99 at submission |
| B. Membership $15/mo, auto-paused in $0 months | Patient | Monthly (~8 mo/yr) | $120 | 62% | none; Reimbursify $29.99/10-pack |
| C. Practice Sponsor, tiered by accepted claims (see below) | Provider | Monthly base + month-end overage | $99 ($1,537/practice-yr) | 57% | Reimbursify Plus/Pro; Mentaya $29–39 checker |
| D. 8% of dollars recovered | Patient | On payment | $107 | 57% | Mentaya 5% of session at submission |
| Reimbursify (patient) | Patient | Submission | $76 if patient pays every claim; most pay $0 | 60–70% loaded | — |
| Mentaya | Client | Submission, every session | $216 | undisclosed; concierge is COGS | — |

Key finding: every outcome-fair model converges at $99–120 per patient-year. Mentaya gets ~2× by charging on $0 (pre-deductible) outcomes. Model C's earlier flat seat ($62/mo, unlimited) yielded only $74/patient at 43% and inherited Reimbursify's flat-seat-vs-variable-claims leak; tiering fixed both.

## Model C — tiered practice plan (decided 2026-09-17)

Per practice (Tax ID), unlimited clinicians. Metered on claims **accepted by the payer (277CA)**; rejections, duplicates, corrected claims, appeals and status inquiries never count. Monthly allowance, no rollover; overage billed at month end; upgrade prompt when base + overage exceeds the next tier two months running; downgrades next cycle, in-flight claims stay sponsored.

| Tier | Monthly | Accepted claims incl. | Overage | Eff. $/claim at full use | Margin 100% / 60% use |
|---|---|---|---|---|---|
| Basic | $0 | 0 (patients pay-when-paid) | — | — | dashboard, referral link, free benefits checker + widget |
| Starter | $59 | 25 | $3.50 | $2.36 | 27% / 55% |
| Growth | $149 | 60 | $3.00 | $2.48 | 30% / 57% |
| Group | $399 | 150 | $2.50 | $2.66 | 35% / 60% |
| Network | custom, 1,000+ claims/mo commitment | negotiated | $2.25 floor | ≥ $2.25 | ≥ 27% |

Blended (55/35/10 mix, 60% utilization, 15% of practices in overage): $128/practice/mo for 31 accepted claims = $4.13/accepted claim, ~15.5 patients/practice, 57% contribution. Cost to serve $1.65/claim (clearinghouse + eligibility + vision $0.65, support $1.00). Overage margins 53% / 45% / 34%.

Versus Reimbursify: same $59 entry, 25 accepted claims + loop vs 10 courtesy filings; above ~50 claims/mo Reimbursify Pro ($99 unlimited) is cheaper and unprofitable ($1.24/claim at 80). Versus Mentaya: practice pays $2.36–2.66/claim, client $0, vs practice $0 / client 5% every session ($720/mo at 80 claims).

## Shared assumptions (base)
24 claims/active patient/yr (claim = session); 55% paid / 35% deductible / 10% denied; $180 session, $110 recovered per paid claim; COGS $1.65/claim on all claims; Stripe 2.9% + $0.30. Patients 2,500 / 10,000 / 30,000 (Y1–Y3); low ×0.5, high ×1.7. Model C: 250 / 1,000 / 3,000 paying practices; low ×0.5, high ×1.6.

## 3-year base ARR
A $275K → $1.10M → $3.29M · B $300K → $1.20M → $3.60M · C (tiered) $384K → $1.54M → $4.61M · D $268K → $1.07M → $3.22M. Y3 low/high: A $1.6–5.6M, B $1.8–6.1M, C $2.3–7.4M, D $1.6–5.5M. Volume spread (3.4×) dwarfs model spread. C's 3,000-practice count is the assumption to challenge hardest (Reimbursify: ~620 paid seats in 8 years). Excludes CAC, C's sales cost, Network/embedded revenue.

## Recommendation
If only one model: **A** — works standalone from day one, no sales team, no provider gating, forces the loop to be built (fee fires only on confirmed payment), keeps "never a percentage," and B/C can be layered on later without a price increase. Full plan: lead with A; B as the upgrade after the second superbill (web-billed only); tiered C for practices that want to sponsor; D reserved for claim-rescue/appeals at 15–20% of recovered. Never: charge at submission, % of session fee, money movement, float. Blended Y3 (55% A / 30% B / 15% sponsored via ~290 practices) ≈ $3.3M.

Validate first: claims/patient/yr (±6 → ±25% revenue), paid share, Y1 patient count, support cost/claim, B pause months, tier allowance utilization (60% assumed).

Model scripts: `revmodel.py`, `tiers.py` (session scratch; re-derivable from the assumptions above).
