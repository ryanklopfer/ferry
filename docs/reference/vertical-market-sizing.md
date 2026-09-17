# Vertical market sizing — which practitioner types fit patient-direct superbill filing (2026-09-16)

## Why therapy is the default vertical
Four structural conditions make out-of-network (OON) superbill filing work, and psychotherapy is the only field that has all four:
1. **OON is normal, not an exception.** Milliman (2017 data): 17.2% of behavioral-health office visits were OON vs 3.2% primary care / 4.3% med-surg. RTI (2019–21): psychologists 10.6x, psychiatrists 8.9x more likely to be OON than med-surg clinicians. 35% of Psychology Today therapists take no insurance; only 13.8% of PhD psychologists do; APA 2024: 34% of psychologists are in no network, 48% of those used to be.
2. **Coverage is unquestioned.** Parity law forces PPOs with any OON benefit to cover OON psychotherapy with no visit caps stricter than med-surg. One CPT (90837), one diagnosis, no units, no supplies → the claim is trivially repeatable.
3. **Recurring, high-dollar, identical claims.** Weekly at $143–$196/session ≈ $7–10K/yr per client; 50–70% back post-deductible is worth thousands, so a 5%/claim fee is invisible.
4. **Providers can legally stay out of Medicare** (psychologists, LCSWs can opt out), and the clients skew under-65, PPO, urban, higher income. Solo practices with EHRs (SimplePractice) that auto-generate superbills and zero billing staff → they hand the problem to the patient.

## Field-by-field (rough, order-of-magnitude estimates; assumptions inline)
Reimbursable pool = private-pay spend × share of patients with usable OON benefit × typical OON allowed/paid rate. Product revenue ≈ 5% of session fee on filed claims, or a provider subscription.

| Field | Private-pay prevalence | Ticket / cadence | Friction | Est. private-pay spend → reimbursable pool | Fit |
|---|---|---|---|---|---|
| Psychotherapy | ~35% fully private; more hybrid (~175K PT-listed) | $150–200, weekly | Low: parity, single CPT, opt-out OK | ~$5–6B → ~$1.5B | Core; most contested |
| Psychiatry | Lowest insurance acceptance of any physician specialty; 8.9x OON | $250–500, monthly med mgmt | Low: same rails/parity; MDs can opt out | ~$3–4B → ~$1B | Best adjacency — same patients, same CMS-1500 |
| Physical therapy | Cash-PT is a growing minority (~5–10% of clinics, est.) of a ~$50B industry | $150–250, episodic 8–12 visits | Medium: timed codes/units, visit caps, PT cannot opt out of Medicare (mandatory claims) → under-65 only | ~$2–3B → ~$0.6–0.8B | Good second vertical |
| Pediatric SLP / OT | Heavily private pay (developmental-delay exclusions) | $120–200, weekly | High denials → appeals engine is the differentiator | ~$1–2B → ~$0.3–0.5B | Good if follow-up automation is strong |
| Dietitians | Mostly private pay | $100–200, few visits | Diagnosis-dependent coverage (ACA preventive) | ~$0.5B → ~$0.15B | Niche add-on |
| Chiropractic | ~8% fully cash, 38% get ≤25% cash; 33.6M users/yr; 40% of users have no chiro coverage | $50–100, high volume | High: visit caps (20–30), maintenance care excluded, many plans have no OON chiro benefit, 57–62% reimbursement on billed, DCs cannot opt out of Medicare (CMT must be billed) | ~$2–3B cash spend → ~$0.3–0.4B | Weak for per-claim patient fees; possible as provider-side batch tool |
| Functional / integrative MD | Almost all private pay | $300–600 | Non-covered codes/labs; low reimbursability | ~$1–2B → ~$0.2–0.3B | Lumpy, denial-heavy |
| Concierge / DPC | 60% concierge (still bills in-network), 40% DPC | membership | Membership fees are not claimable | ≈ 0 | None |
| Acupuncture / massage | 75% / 85% of users have no coverage | $80–150 | Coverage mostly absent | small | None |

## Chiropractic specifically
Chiro looks attractive on volume (33.6M adults/yr, ~70K DCs, 57% solo) but the per-claim economics invert the therapy case: low ticket, capped and often absent OON benefit, maintenance/wellness care (the bulk of cash chiro) is explicitly non-covered, and the DC must bill Medicare directly for spinal manipulation (no opt-out). A 5% fee on a $60 visit is $3 for maybe $30 back, and the patient bears high denial risk. If pursued, the wedge is the hybrid PPO-heavy sports/functional chiro at $100–200/visit, sold as a provider subscription that batch-files and predicts denials — not a patient-paid per-claim product. Chiro's real reimbursement pain (auto/PI MedPay, workers' comp) is a different product.

## Ordering
Psychotherapy + psychiatry (launch) → PT + chiropractic (phase 2, provider-led — decided 2026-09-17; build details in `mentaya-teardown-and-product-framework.md` §5.1) → pediatric SLP/OT → dietitians → functional med → DPC (never).

Chiro moved up from "provider-side only, late" because the pay-when-paid fee's 10% cap on amount recovered ($30 back → $3 fee) plus the Practice Sponsor plan resolve the per-claim economics problem above; the service-type-33 eligibility gate (no OON chiro benefit → nothing filed) resolves the denial-risk problem. The wedge is still hybrid PPO-heavy sports/functional chiro at $100–200/visit, not wellness/maintenance care.
