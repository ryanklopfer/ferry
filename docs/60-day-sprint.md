# 60-Day Sprint — Sep 21 – Nov 19, 2026 (replanned Sep 27)

Scope is the clinician membership in `prd.md`: an AI scribe, notes with codes, letters from the clinician's own notes, and every client's out-of-network claim filed and chased, for one monthly membership. Replanned on Sep 27 (Day 7), when the product was redefined. Slices, gates and their acceptance criteria live in `sprint-tasks.md`; this file holds the calendar, the goals and the metrics.

Code is still not the critical path. BAAs, the attorney's texts, Stedi enrollment per clinician NPI, AWS access to HealthScribe, and recruiting ten paying clinicians are. So the build runs on fixtures and synthetic data until each account lands, and each account flips one setting.

## Definition of done (Day 60, Thu Nov 19)

The PRD goals:

1. **Clinicians pay for it.** 50 paying members by Nov 19 (stretch 80), from a 7-day free trial.
2. **The note is the fast part of the day.** Median time from session end to approved note under 5 minutes.
3. **Every session becomes a claim.** At least 70% of approved notes for clients with insurance on file produce a filed claim the same day.
4. **Clients get money back.** 100 client claims accepted electronically by Nov 19; 20+ paid or counted toward the deductible (payers take 2–6 weeks, so this lags).
5. **Paperwork insurers ask for costs the clinician under 5 minutes.** Median time from insurer request to approved letter under 5 minutes of clinician time.

Measured by the PRD success metrics (`prd.md`, "Success metrics"), all on `/ops/metrics` (S29):

| Metric | Type | Target | Measured from |
|---|---|---|---|
| Trial → first approved note within 48 h | Leading | 60% | `claim_events` + notes table |
| Session end → approved note, median | Leading | < 5 min | note timestamps |
| Approved notes that file a claim same day (insured clients) | Leading | 70% | notes joined to claims |
| Scans accepted on first try | Leading | 85% | scan events |
| Trial → paid | Lagging | 40% (stretch 55%) | Stripe |
| Paying members at Nov 19 | Lagging | 50 (stretch 80) | Stripe |
| Members still paying after 60 days | Lagging | 80% | Stripe, evaluate Jan 2027 |
| Client claims accepted / paid by Nov 19 | Lagging | 100 / 20+ | `claim_events` |

Payers adjudicate in 2–6 weeks, so paid counts lag; the Day-60 read is paying members, approved notes, and accepted claims with a working loop.

## Key dates

| Date | What |
|---|---|
| Sep 28 | Build restarts: docs of record, safety rails, audio core |
| Sep 29 | Gate A: phone mic test on Ryan's iPhone (decides D4) |
| Sep 30 | D2 (cuts and PRD changes) and D4 due; LLC, AWS, Stedi and attorney started |
| Oct 1 | Preview homepage in the prelaunch tier, so recruiting can start |
| Oct 2 | Gate B: isolation, column classification, raw-dump and crypto-shred tests green |
| Oct 4 | D1 price and D5 recording cost due |
| Oct 9 | M1 / Gate C: the thin path end to end on fixtures |
| Oct 10–11 | M2: record and dictate through the same path; Ryan's device test |
| Oct 15–16 | Buffer; AWS live by Oct 16 at the latest; staging provisioned |
| Oct 17 | Gate D: the freeze walkthrough |
| **Oct 18** | **Feature freeze** |
| Oct 19–28 | Letters, insurer mail, denials, notifications, hardening, vendor cutover, ops |
| Oct 29 | Gate E2: the post-freeze walkthrough |
| Nov 1 | Gate E go/no-go: `preflight:real-data` exits 0 on prod, or the beta waits |
| **Nov 2–15** | **Beta: 10 paying clinicians on the real stack, fixes only** |
| **Tue Nov 17** | **Launch: open sign-up** |
| Thu Nov 19 | Day-60 review against the metrics table |

**The rule after the freeze (Day 28, Oct 18):** no new features unless a beta clinician, a payer rejection or a launch blocker asks for it. The post-freeze P0 slices already scheduled (letters, insurer mail, notifications, hardening) are the exception, and Gate E2 proves them.

## Workstreams

1. **Build** — the product. Heavy through Oct 29, then fix-driven.
2. **Payer & compliance** — payer directory, Stedi enrollment per beta clinician NPI, BAAs (AWS, Stedi, Sinch, SMS if used), the attorney's texts, AWS quotas.
3. **Beta cohort** — ten paying clinicians and their clients: recruiting from the preview homepage from Oct 1, names and NPIs by Oct 9, onboarding from Nov 2.
4. **Money & metrics** — Stripe Billing (trial, card, cancel), `/ops/metrics`.
5. **Launch** — name, domain, homepage, launch-day channels.

## Phases

### Build (Sep 28 – Oct 18)

**Goal:** a clinician signs up free, adds a client who accepts on their phone and consents, records or types a session, approves a note with codes, and the claim files and moves through the 16-state loop, all on fixtures, with transcripts erased at 24 hours.

Order: docs and safety rails, the phone spike (Sep 29), the access model, foundations (UI, encryption, consents, state machine, billing, payers), a thin fixture path end to end (M1, Oct 9), voice (M2), then depth (NPPES, eligibility, card scanning, status polling, infrastructure as code) and a buffer. Gate D closes it.

Payer & compliance: F1 LLC/EIN, F2 Stedi paid account, F4 attorney and F5 AWS Organization all started Sep 30; per-NPI enrollments submitted by Oct 9; AWS live by Oct 16.

Beta cohort: preview homepage up Oct 1 with "Join the beta"; ten clinicians named by Oct 9.

### Letters and hardening (Oct 19 – Nov 1)

**Goal:** everything insurers send back is handled, and the real stack is safe to switch on.

Letters from progress notes with citations, insurer mail and EOB scans, denials with one appeal template, notifications, row-level security, limits, export and deletion, vendor cutover and the real-data preflight, ops metrics. Gate E2 on Oct 29; Gate E on Nov 1. Attorney's final texts by Oct 23; beta clinicians re-consent to them before Nov 1.

### Beta (Nov 2 – 15)

**Goal:** the product survives ten paying clinicians and their real clients.

Build: fixes only. Weekly feedback calls; every rejected claim or failed note gets a written root cause the same week.

### Launch (Nov 16 – 19)

Tue Nov 17: open sign-up (`FERRY_OPEN_SIGNUP=1`). Wed–Thu: respond to everything within an hour and ship fixes daily. Thu Nov 19: Day-60 review against the metrics; write the Phase 2 plan (store apps, group plan, PT and chiropractic, EHR push) from what members asked for.

## Week by week

| Week | Dates | Build | Everything else | Gate |
|---|---|---|---|---|
| 1 | Sep 21–27 | S1–S3 (Postgres, data model, sign-in); product redefined | PRD and spec written; HealthScribe and 24-hour erasure decided | — |
| 2 | Sep 28–Oct 4 | Docs, safety rails, audio core, installable shell, phone spike, access model, tenancy, UI, homepage, encryption, consents, clinician onboarding, state machine, billing, payers | D2, D4, D3, D1, D5; LLC, AWS, Stedi, attorney started; preview homepage live | A (Sep 29), B (Oct 2) |
| 3 | Oct 5–11 | Clients and invites, LLM provider, typed capture and erasure, notes, claims and 837P, submission, auto-file, client tracker, scribe, relay, record and dictate | Beta clinician names and NPIs; enrollments submitted | C / M1 (Oct 9), M2 |
| 4 | Oct 12–18 | NPPES, eligibility, card scanning, scan camera, status polling, infrastructure as code, staging | AWS live by Oct 16; timed client welcome on phones | D (Oct 17); freeze Oct 18 |
| 5 | Oct 19–25 | Letter engine, cited letters, denials, insurer mail, notifications, row-level security | Attorney's final texts (Oct 23) | — |
| 6 | Oct 26–Nov 1 | Hardening, vendor cutover and preflight, ops metrics | Beta re-consent; icon and logo; allow-list | E2 (Oct 29), E (Nov 1) |
| 7 | Nov 2–8 | Fixes only | Beta: 10 paying clinicians | — |
| 8 | Nov 9–15 | Fixes only | Beta continues; launch assets | Zero P0 bugs |
| 9 | Nov 16–19 | Daily fixes | Launch Nov 17; Day-60 review Nov 19 | Metrics table |

## Budget (60 days)

Unchanged from the Sep 17 plan except where noted. Recording cost depends on D5.

| Item | Estimate |
|---|---|
| Healthcare attorney (terms, privacy, BAA, filing authorization, consents) | $2,500–4,000 |
| AWS hosting, database, storage and keys under the BAA (staging and prod) | $200–500 |
| Claude inference on Bedrock (notes, codes, letters, scans) | $100–300 |
| AWS HealthScribe during beta (list $0.10/min; about $430 per clinician-month at 20 fifty-minute sessions a week) | depends on D5 |
| Stedi transactions (claims, eligibility, status checks) | $150–300 |
| Claude Code subscription (2 months, Max tier) | $200–400 |
| SMS (if used) and e-fax | $100–200 |
| Stripe fees | < $50 |
| Domain, email, error monitoring | $150–300 |
| Cyber liability insurance (first installment) | $300–600 |
| Beta incentives (gift cards for feedback calls) | $500–800 |

## Weekly cadence

Through Oct 29: every session ends green and committed; each gate is demoed to Ryan the day it passes. From Nov 2: Monday 30-minute plan; daily, ship something visible to the beta clinicians; Thursday, three feedback calls; Friday, metrics updated from `/ops/metrics` and decisions appended to the log in `CLAUDE.md`. Every failed claim gets a written root cause the same week; those become payer-playbook entries.

## Risks and the response to each

The full list, with owners, is under "Open risks" in `sprint-tasks.md`. The ones that move dates:

| Risk | Signal | Response |
|---|---|---|
| Code outruns compliance: real client data on a stack without every BAA | Any BAA or legal text missing on Nov 1 | `preflight:real-data` fails and the beta waits. Not for a day, not for one clinician |
| iPhone recording stops on lock, calls or app switch in the installed app | Gate A (Sep 29) or the device test after M2 fails | Gap marking and "Dictate the rest"; launch records in a Safari tab if installed mode fails |
| Recording cost exceeds the membership price | D5 on Oct 4; scribe:eval after AWS lands | Cap hours, raise the price, default to dictation, or record with Transcribe plus Claude |
| Stedi enrollment lags for a beta clinician's payers | Enrollment not active by Nov 2 | Member-form claims: the clinician prints and mails, or Ferry faxes |
| The pace (about two slices a day) doesn't hold | Buffer used up by Oct 15 | Apply the slip order in `sprint-tasks.md`; it moves dates or trims conveniences and never removes the only proof of a P0 checkbox |
| Claims don't adjudicate inside 60 days | Paid near zero at Day 45 | Expected for some payers; judge on accepted claims and the loop; extend paid-claim measurement to Day 90 |

## Kill / pivot signals at Day 60

Set by Ryan at the Day-60 review against the PRD success metrics. The Sep 17 signals (patient filing counts, provider tap rate) no longer apply.

## Decisions with deadlines

| Decision | By |
|---|---|
| D2: what gets cut, and the 12 PRD wording changes | Sep 30 |
| D4: installable web app at launch, store apps P1 | Sep 30 |
| D3: clients of non-member therapists get an invite-your-therapist link only | Oct 1 |
| D1: exact monthly price and yearly option ($50 placeholder, held in `PRICING`) | Oct 4 |
| D5: recording cost vs price | Oct 4 (revisit after the live scribe:eval) |
| Product name and domain | Before the preview homepage goes public |
| Beta go/no-go | Nov 1 (Gate E) |
| Phase 2 order | Day 60, from what members asked for |
