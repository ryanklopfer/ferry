# 60-Day Sprint — code first, then reality (Sep 21 – Nov 19, 2026)

Scope is Phase 1 of `mentaya-teardown-and-product-framework.md` §5. Revised Sep 17 to front-load the build: with Claude Code as the second engineer, the software is not the critical path — Stedi enrollment, BAAs, real superbills, payer adjudication, and beta recruiting are. So the plan writes essentially all Phase 1 code in the first three weeks against sandbox and test data, then spends the remaining five and a half weeks running it against real payers and real patients, fixing what breaks.

**The rule after Day 21:** no new feature gets built unless a beta patient, a payer rejection, or a launch blocker asks for it. Code time is capped at roughly a third of each week; the rest is cohort, payers, compliance, and launch.

## Definition of done (Day 60, Thu Nov 19)

Unchanged. A stranger with a superbill from a therapist or psychiatrist we've never seen can photograph it, see their estimated reimbursement, and have an electronic claim accepted by the payer (277CA) in under five minutes with zero typing — and then watch it move through the loop.

| Metric | Day 30 | Day 45 | Day 60 |
|---|---|---|---|
| Beta patients who filed ≥1 claim | 10 | 25 | 50 |
| Claims submitted (electronic + member-form) | 25 | 75 | 150 |
| Providers who tapped the magic link | 3 | 6 | 10 |
| Claims reaching `accepted` electronically | 15 | 50 | 100 |
| Claims reaching `paid` / `applied_to_deductible` | 0–2 | 5 | 20+ |
| Pay-when-paid fees charged | 0 | 3 | 15+ |
| Autopilot subscribers | 0 | 3 | 10 |
| Payers with n ≥ 10 on the public scorecard | 0 | 1 | 3 |
| Median photo → `ready` time | < 3 min | < 2 min | < 90 s |

Payers adjudicate in 2–6 weeks, so paid-claim counts lag; the Day-60 gate is *accepted* claims and a working loop, not revenue. The beta targets are unchanged from the original plan because they are gated by recruiting and BAAs, not by code.

## Assumptions

Solo founder, most of the week on this, Claude Code as the second engineer working in session-sized slices (see `docs/` in the repo once written). Cash budget ~$6–9K over 60 days. Existing MVP at `~/Desktop/superbill-claims` (Next.js 16, Drizzle, vision extraction, packet PDF, follow-up timers, letter drafting) is the starting codebase. Name decided by Day 10 or we launch on a placeholder domain. Fee numbers come from the pricing conversation by Day 14; $9 pay-when-paid / $15 Autopilot are placeholders.

Weeks 1–3 assume Stedi sandbox access and a set of test superbills on Day 1. Nothing in Weeks 1–3 requires a signed BAA because nothing touches real PHI — synthetic and de-identified test data only.

## Workstreams

1. **Build** — the product. Heavy Weeks 1–3, then fix-driven.
2. **Payer & compliance** — payer directory, playbooks, BAAs, legal docs, hosting.
3. **Beta cohort** — recruiting patients and providers, support, feedback loop.
4. **Money & metrics** — Stripe, fee events, scorecard, analytics.
5. **Launch** — name, domain, landing page, SEO pages, launch-day channels.

## Sprint 0 — Before Monday (Sep 17–20): Unblock the build

Everything here exists so Claude Code is never waiting on you during Weeks 1–3.

Open a Stedi account, fund $100 of credits, confirm sandbox access to eligibility (270/271), claims (837P), and claim status (276/277); request the BAA and start production enrollment now because it is the longest lead time in the plan. Read the Stedi 837P JSON reference and the transaction-enrollment doc end to end. Create the Stripe account. Register the entity (LLC is fine) and get an EIN — Stedi, Stripe, and the BAAs all need it. Pick the HIPAA-eligible stack and start the BAAs (decision by Day 3, but start the paperwork now): Postgres + object storage + auth from a vendor that signs one (Supabase HIPAA add-on is fastest; AWS is safest), Claude via AWS Bedrock or Anthropic's enterprise BAA (the consumer API key in the MVP is not an option for PHI), Twilio with BAA. Buy a placeholder domain.

Build the test corpus: collect at least 10 real superbills and insurance cards from your own network this week, de-identify them, and ask every candidate on the beta list for theirs — the extraction gate needs 30+ and this is the slowest-to-collect input in Weeks 1–3. Generate 10 synthetic ones covering the ugly cases (handwritten, multi-DOS, testing codes, telehealth modifiers, missing NPI).

Write `CLAUDE.md` and `docs/sprint-tasks.md` in the repo: stack, run/test commands, coding conventions, product invariants (patient is payee, CLM07 = C, CLM08 = N, no PHI in SMS bodies, Bedrock only for PHI), and the slice list below with acceptance criteria. Draft the beta invitation message and post nothing yet.

## Sprint 1 — Days 1–7 (Sep 21–27): Core pipeline code-complete in sandbox

**Goal:** a test superbill goes photo → extraction → eligibility → 837P → 277CA accepted in the Stedi sandbox, on a multi-user, encrypted, authenticated app.

Build, in this order, one slice per Claude Code session, each ending green and committed:

1. SQLite → Postgres with Drizzle; tests pass; migration script for existing local data.
2. Multi-user data model with per-tenant scoping; PHI columns encrypted at rest with a KMS-backed key.
3. Auth: magic link + passkeys; session handling; account settings.
4. Vision extraction run against the full test corpus with a scoring harness that reports per-field accuracy (NPI, DOS, CPT, ICD, charge); iterate the prompt to ≥95%.
5. Insurance-card extraction (payer name, member ID, group, plan type) into the plan record.
6. NPPES lookup by NPI; taxonomy and address fill; provider record cache.
7. 270/271 eligibility via Stedi with a plain-English result screen (OON benefits, deductible remaining, estimated reimbursement).
8. 837P builder from a claim record (CLM07 = C, CLM08 = N, patient as payee, non-par submitter); validated against Stedi's CMS-1500 validator on the whole corpus.
9. Claim submission + 277CA ingestion; rejection reasons parsed and surfaced.
10. Replace the fixed lifecycle with the 14-state machine from framework §3.4 — all states, transitions, and timers defined; timers wired for `submitted`, `accepted`, `in_adjudication`.
11. Provider authorization magic link (SMS via Twilio, no PHI in body) that unlocks the electronic path; member-form packet remains the fallback when no provider has tapped.

Payer & compliance: payer directory seeded for the top 15 payers (Aetna, Cigna, UHC/Optum Behavioral, Anthem BCBS CA/NY/CO/others, BCBS IL/TX/MA/NC, Oxford, Horizon, Empire, Kaiser PPO, Meritain/UMR) with payer ID, claims + appeals addresses, timely-filing days, non-par enrollment flag from Stedi `transactionSupport`, paper-check flag, state DOI contact. Healthcare attorney engaged for the authorization form, privacy policy, ToS, and BAA review. Hosting and Claude-provider decisions made by Day 3.

Beta cohort: build the list of 40 warm candidates (own network's therapy clients; testing psychologists and their clients; therapists who complained publicly about Thrizer's Aug-2026 superbill shutdown; r/therapists and r/HealthInsurance; Psychology Today OON profiles in NY/CA/MA/CO). Ask each therapist for one thing: "would you send this to two clients who file their own superbills?" Collect superbills from every yes.

Money & metrics: Stripe customer + card-on-file on signup; fee event stubbed; PostHog with funnel events (photo, extracted, eligibility, ready, submitted, accepted).

Launch: name shortlist; landing page with one action ("Snap your superbill") and waitlist capture.

**Exit gate (Day 7):** sandbox claim `accepted` end to end from a photo; extraction ≥95% on the corpus; eligibility results for 5 payers in sandbox; all 11 slices committed with tests.

## Sprint 2 — Days 8–14 (Sep 28 – Oct 4): The loop code-complete

**Goal:** everything that happens after `accepted` exists and is exercised with simulated payer responses.

Build slices:

12. Mobile-first timeline UI with the state copy from framework §3.4; this is the product surface.
13. 276/277 polling on a per-payer cadence with ETA updates; simulated 277 fixtures for every state.
14. `stalled` → status-inquiry letter auto-generated and sent by e-fax or queued for portal per payer directory.
15. `info_requested` → provider records-request magic link.
16. EOB upload with vision parsing → `paid` / `partially_paid` / `applied_to_deductible` with amounts; test on 10+ real EOBs from the cohort.
17. `denied` with CARC/RARC translation and three appeal templates (medical necessity, timely filing, non-covered/wrong code).
18. Notifications: push/SMS/email, exactly one per state change; deductible progress on the home screen.
19. Autopilot: email-forward inbox per user (`you@claims.<domain>`) creating drafts from forwarded superbill PDFs; provider SMS "YES" creating claims from last known defaults.
20. Fee events: pay-when-paid bound to `paid`/`partially_paid` with the 10%-of-recovered cap; Autopilot subscription with auto-pause in months with no paid claim; refund = Stripe reversal.
21. Funnel dashboard.

Payer & compliance: playbooks for the top 5 payers; DOI complaint addresses for NY, CA, MA, CO, IL, TX; BAAs signed with Stedi, hosting, Claude provider, Twilio; cyber liability quote.

Beta cohort: first 3–5 patients onboarded by hand as soon as the BAA stack is live — if BAAs are not signed by Day 14, they run on de-identified test claims only. Name decided by Day 10.

Launch: SEO pages drafted ("how to file a superbill with [payer]" × top 8, "Thrizer alternative," "Reimbursify alternative"); not published.

**Exit gate (Day 14):** every one of the 14 states reachable in a demo with fixtures; a forwarded email becomes a draft claim; a fee event fires on a simulated `paid`; a real claim submitted in Stedi production if enrollment has cleared.

## Sprint 3 — Days 15–21 (Oct 5–11): Everything else, and hardening

**Goal:** Phase 1 code-complete. From Day 22 the codebase is maintained, not built.

Build slices:

22. Misdirected-payment playbook (`paid` with payee ≠ patient → refund-to-patient letter + provider confirm link).
23. `escalated` state with DOI complaint generator for the 6 states.
24. Provider light account: NPPES prefill, licenses, per-patient defaults learned from superbills; "invite my provider" from the patient home screen.
25. Pre-submit scrubber rules per payer (modifier 95/GT, POS 02/10 for telehealth, taxonomy, timely filing); psychological-testing lines (96130/96131/96136/96137, units).
26. Non-par registration packet flow (e-sign W-9, license upload; tracked object with ETA).
27. Public scorecard page reading live from the state machine.
28. Hardening: rate limiting and abuse controls on the free eligibility check; error-state copy for every failed extraction and rejected 277CA; audit log; account deletion and data export; accessibility pass on the timeline.
29. Ops: alerting on stalled timers and failed Stedi calls; backup/restore drill; performance target photo → `ready` < 90 s p50.
30. Pricing page (placeholder numbers), privacy/ToS/authorization pages wired to the attorney's drafts.

Payer & compliance: SOC 2 readiness checklist started (manual control list; tooling optional). HIPAA policies written from a template.

Beta cohort: 5–10 patients live on the production stack; weekly 20-minute feedback call with 3; shared support inbox with a 4-hour reply target.

**Exit gate (Day 21):** code-complete. Zero open slices. A stranger-style walkthrough on the production stack with a test payer completes unassisted. Runbook for the on-call alerts written.

## Sprint 4 — Days 22–42 (Oct 12 – Nov 1): Reality

**Goal:** the loop proves itself against real payers and real patients. This sprint is where the original plan's Sprints 2 and 3 outcomes happen, with the code already in place.

Build: fix-driven only. Every rejected 277CA, failed extraction, misparsed EOB, or patient hesitation gets a written root cause the same week and, where the fix is code, a slice. Expect payer-specific scrubber rules, extraction prompt changes, and copy fixes to dominate. Budget one to two Claude Code sessions per day at most.

Payer & compliance: non-par enrollments submitted for every payer in the cohort's plans; playbook entries written from real rejections; BCBS home-plan routing and Optum carve-out verified with real claims; attorney documents finalized.

Beta cohort: 10 patients by Day 28, 25 by Day 42; 6 providers on the magic link; three feedback calls each Thursday; first testimonial; NPS in-app after first `accepted`.

Money & metrics: first pay-when-paid charge; unit-economics sheet updated with real Stedi, Stripe, and Claude costs per claim; days-to-accepted and days-to-paid by payer.

Launch: name and brand locked; domain moved; PWA install prompt confirmed as the distribution path; launch post drafted; 3 podcast/newsletter hosts in the therapist-business circuit contacted.

**Exit gate (Day 42):** 25 patients, 75 claims, ≥50 `accepted` electronically, ≥5 `paid`/`applied_to_deductible` with parsed amounts, ≥3 fees charged with no support ticket, one provider who came in through a patient and stayed, timers and letters firing in production without manual intervention.

## Sprint 5 — Days 43–56 (Nov 2–15): Open the doors

**Goal:** the product survives strangers.

Build: only launch blockers and P0/P1 bugs. Second stranger test on Day 45 and Day 52 with someone who has never seen the app.

Payer & compliance: privacy policy, ToS, authorization form final and published; breach-response runbook; incident contact on the site; cyber liability bound.

Beta cohort: waitlist opened; 50 patients; 10 providers; three "I switched from Reimbursify/Mentaya" stories in writing.

Money & metrics: pricing page live with final numbers; scorecard shows 3 payers with n ≥ 10; weekly cohort report automated.

Launch: SEO pages published; launch day Tue Nov 17; Product Hunt / Reddit / therapist newsletter assets ready; "file your 2026 sessions before your deductible resets Jan 1" is the hook.

**Exit gate (Day 56):** zero P0 bugs, stranger test passes unassisted, legal docs published.

## Days 57–60 (Nov 16–19): Launch

Tue Nov 17: publish. Wed–Thu: respond to everything within an hour, log every failure, ship fixes daily. Fri Nov 19: Day-60 review against the metrics table; write the Phase 2 plan (PT + chiro, DOI generator for all states, native wrapper, Practice Sponsor plan, EHR integrations) from what the cohort asked for.

## Week-by-week

| Week | Dates | Build | Everything else | Gate |
|---|---|---|---|---|
| 1 | Sep 21–27 | Slices 1–11: Postgres, auth, encryption, extraction, eligibility, 837P, 277CA, state machine, magic link | Payer directory, attorney engaged, list of 40, BAAs in flight | Sandbox claim accepted from a photo; extraction ≥95% |
| 2 | Sep 28–Oct 4 | Slices 12–21: timeline, polling, letters, EOB, denials, notifications, Autopilot, fees | Playbooks top 5, BAAs signed, name decided, first 3–5 patients | All 14 states demoable; fee fires on simulated paid |
| 3 | Oct 5–11 | Slices 22–30: misdirected payment, escalation, provider account, scrubber, scorecard, hardening, ops | SOC 2 checklist, 5–10 patients live | Code-complete; stranger walkthrough on prod |
| 4 | Oct 12–18 | Fix-driven | 10 patients / 25 claims; enrollments submitted | First real `accepted`; timers firing in prod |
| 5 | Oct 19–25 | Fix-driven | 15 patients, 3 providers; DOI letter generated on a real stall | First `paid` parsed from a real EOB |
| 6 | Oct 26–Nov 1 | Fix-driven | 25 patients, 6 providers; brand locked | First fee charged |
| 7 | Nov 2–8 | P0/P1 only | 35 patients; stranger test #2 | Stranger passes |
| 8 | Nov 9–15 | P0/P1 only | 50 patients, 10 providers; legal live; launch assets | Zero P0 |
| 9 | Nov 16–19 | Daily fixes | Launch, Day-60 review | Metrics table |

## Budget (60 days)

| Item | Estimate |
|---|---|
| Healthcare attorney (authorization form, privacy, ToS, BAA review) | $2,500–4,000 |
| HIPAA-eligible hosting + DB + storage with BAA | $200–500 |
| Stedi transactions (≈150 claims + 300 eligibility + 600 status polls, plus sandbox) | $150–300 |
| Claude inference (extraction, letters) | $100–300 |
| Claude Code subscription (2 months, Max tier) | $200–400 |
| Twilio SMS + e-fax | $100–200 |
| Stripe fees | < $50 |
| Domain, email, analytics, error monitoring | $150–300 |
| Cyber liability insurance (first installment) | $300–600 |
| Compliance tooling trial (optional) | $0–500 |
| Beta incentives (first 3 claims free for the cohort, $20 gift cards for feedback calls) | $500–800 |
| **Total** | **~$4,200–7,900** |

## Weekly cadence

Weeks 1–3: Monday, pick the week's slices and gate; every session ends with a green test run and a commit; Friday, demo the week's gate to yourself on video (these become onboarding material). Weeks 4–9: Monday 30-minute plan; daily, ship something visible to the cohort; Thursday, 3 patient feedback calls; Friday, metrics table updated, decision log appended to the framework doc. Every failed claim gets a written root cause the same week — those become payer-playbook entries.

## Risks and the response to each

| Risk | Signal | Response |
|---|---|---|
| Code outruns compliance — temptation to put real PHI on a non-BAA stack because the app is ready | BAAs not signed by Day 14 | Cohort runs on de-identified test claims only. Not for a day, not for one friend. Sprint 4 shifts right; Day 60 does not |
| Stedi production enrollment or non-par payer enrollment lags | No real `accepted` by Day 28 | Member-form packet carries the cohort; keep filing electronically in sandbox; escalate with Stedi support weekly |
| Building cheap turns into building more | New non-fix slices appearing after Day 21 | The Day-21 rule. Log the idea in the Phase 2 list and move on |
| Payer rejects non-assigned claims from an unknown submitter | 277CA rejections clustered on one payer | Route that payer to member-form fallback; playbook entry; don't fight it in the sprint |
| Providers won't tap the magic link | < 30% tap rate by Day 30 | Member-form path carries the load; test a version with the patient's name and "takes 10 seconds"; lead with the free benefits checker |
| Extraction stalls below 95% on messy real superbills | Manual corrections > 1 field per claim in Week 4+ | "Confirm 3 things" review step becomes the default; collect failures for the prompt harness from Slice 4 |
| Claims don't adjudicate inside 60 days | `paid` near zero at Day 45 | Expected for some payers; judge on `accepted` and loop behavior; extend paid-claim measurement to Day 90 |
| Solo-founder bandwidth in Weeks 1–3 | A week's slices not done by Friday | Cut in this order: scorecard → registration packets → DOI generator → provider light account → appeals beyond one template. Never cut the tracker, the state machine, or the fee logic |

## Kill / pivot signals at Day 60

Unchanged. Pivot the go-to-market (not the product) if fewer than 20 patients filed unassisted, or if provider tap rate is under 20% *and* member-form claims are being rejected at over 30%. Reconsider pay-when-paid only if support cost per paid claim exceeds the fee — track it from the first ticket.

## Decisions with deadlines

| Decision | By |
|---|---|
| Hosting/DB vendor with BAA | Day 3 (Sep 23) — paperwork started in Sprint 0 |
| Claude via Bedrock vs. Anthropic enterprise BAA | Day 3 (Sep 23) |
| Product name and domain | Day 10 (Oct 1) |
| Final fee numbers (pay-when-paid, Autopilot) | Day 14 (Oct 4) |
| Code-complete declared (or scope cut per the risk table) | Day 21 (Oct 11) |
| Launch date | Day 42 (Nov 1) — default Nov 17 |
| Phase 2 order (PT + chiro first vs. Practice Sponsor first) | Day 60, from cohort asks |
