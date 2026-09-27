# Ferry PRD: clinician membership, website and phone app

Owner: Ryan · Written 2026-09-27 · Status: draft for approval
Screens and short requirements: `docs/spec.html`. This PRD is the full version; where they differ, this file wins until the spec is updated.

## Problem statement

Out-of-network therapists and psychiatrists spend unpaid hours after every session writing notes, and more when an insurer asks for records or a medical necessity letter. Their clients pay full price up front and are owed part of it back, but most never file or give up after the first denial, and clients who can't get reimbursed cut back or stop coming. Scribe tools (Twofold: $69/month list, $19 first month as of Sep 27) solve the note but stop there; reimbursement tools (Reimbursify, Mentaya, Thrizer; see `docs/mentaya-teardown-and-product-framework.md`) solve filing but never see the note. Nobody uses the note to get the client paid.

## Goals

1. **Clinicians pay for it.** 50 paying members by Nov 19 (stretch 80), from a 7-day free trial.
2. **The note is the fast part of the day.** Median time from session end to approved note under 5 minutes.
3. **Every session becomes a claim.** At least 70% of approved notes for clients with insurance on file produce a filed claim the same day.
4. **Clients get money back.** 100 client claims accepted electronically by Nov 19; 20+ paid or counted toward the deductible (payers take 2–6 weeks, so this lags).
5. **Paperwork insurers ask for costs the clinician under 5 minutes.** Median time from insurer request to approved letter under 5 minutes of clinician time.

## Non-goals

| Not doing | Why |
|---|---|
| Scheduling, in-network billing, full EHR | Clinicians already have an EHR; we copy into it. Becoming one is a different company. |
| Taking assignment, holding or moving money | Core invariant: the client is the payee, Accept Assignment = No. |
| Charging clients anything | The $9 pay-when-paid plan is deleted. The membership covers every claim. |
| Filing for clients whose therapist is not a member | Removed with the $9 plan; those clients get an "invite your therapist" link only (open decision D3). |
| Specialties beyond psychotherapy and psychiatry | PT and chiropractic stay Phase 2, decided at Day 60. |
| Reviews, user counts or testimonials on the site | Not until they are real. |

## Personas

- **Clinician (member, payer):** solo out-of-network therapist or psychiatrist, 15–30 sessions a week, uses SimplePractice or TherapyNotes, hands clients superbills today.
- **Client:** pays $150–250 per session, has a PPO or Medicare Advantage PPO, wants money back without paperwork.
- **Group admin (P1):** runs a 4–15 clinician practice, wants one bill and shared formats.

## User stories

**Clinician**
1. As a clinician, I want to record a session on my phone or computer so that I don't write the note from memory at 9 pm.
2. As a clinician, I want to dictate a 60-second summary instead when a client declines recording, so I still get a full note.
3. As a clinician, I want the note in my format (SOAP, DAP, BIRP, intake) with suggested codes so that it drops into my EHR unchanged.
4. As a clinician, I want approving a note to file my client's claim so that I stop handing out superbills.
5. As a clinician, I want a drafted necessity letter built from my own notes when an insurer asks, so that I only review and sign.
6. As a clinician, I want to scan a new client's insurance card once so that nobody types a member ID.
7. As a clinician, I want nothing sent to an insurer without my approval so that my license stays mine.
8. As a clinician whose recording failed (dropped connection, phone call interrupted), I want what was captured kept and the gap marked, so I can dictate the rest.

**Client**
9. As a client, I want to accept my therapist's invite, scan my card and consent in under 2 minutes so that my sessions file on their own.
10. As a client, I want to see where each claim is and what Ferry is doing next so that I stop wondering.
11. As a client, I want to scan the letters my insurer mails me so that Ferry acts on them without me reading them.
12. As a client, I want to confirm when a check arrives so that the trip closes.
13. As a client, I never want to see my therapist's session notes in Ferry.

**Edge cases**
14. A client has no out-of-network benefit: the clinician and client are told before anything is filed; the note still saves.
15. A client's insurance changes mid-year: a new scan replaces the plan; claims already filed keep the old plan.
16. A clinician cancels: new notes and filings stop; claims already filed are chased to closure; notes stay exportable for 30 days.

## Requirements

Spec requirement IDs (R1–R13) are noted where they match.

### P0: cannot launch without

**P0-1 Website and pricing** (R1–R3)
- [ ] Homepage per `docs/spec.html`: banner, hero, how it works, security, pricing, questions, footer
- [ ] Pricing shows 7-day trial, membership ($50 placeholder, D1), custom groups; no per-claim fee anywhere
- [ ] At 390 px wide: one column, no sideways scroll
- [ ] No reviews, user counts or testimonials

**P0-2 Sign-up, trial and billing**
- [ ] Given a new visitor, when they tap "Start free", then sign-up asks for email only (magic link or passkey; built in S3), no card
- [ ] BAA and terms accepted at sign-up, stored with a content hash (S3b pattern)
- [ ] Day 5 and day 7: one reminder each; card requested at day 7 via Stripe; no card means read-only, nothing deleted
- [ ] Cancel anytime from Account; takes effect at period end

**P0-3 Clinician profile and authorization**
- [ ] NPI checked against NPPES (S6); Tax ID sealed and shown as last four
- [ ] Clinician sets session fee per CPT code once; claims use it
- [ ] Clinician authorizes Ferry to file non-assigned claims under their NPI (wording from attorney, Q-L1)

**P0-4 Clients and consent** (R4)
- [ ] Clinician adds a client by name and phone or email; the client gets a link with no health details in it
- [ ] Client consents separately to (a) recording and (b) filing, each timestamped; either can be withdrawn
- [ ] Recording controls are disabled for a client without recording consent; dictation and typing still work

**P0-5 Capture** (R5)
- [ ] In-room recording on phone or computer; dictation; typed rough notes
- [ ] Interrupted recording keeps what was captured and marks the gap
- [ ] Audio streams through AWS HealthScribe and is never written to our disk or S3; HealthScribe's transcript and note files are deleted from S3 once imported; the screen says "Audio deleted" (R9)

**P0-6 Notes** (R6)
- [ ] Note in the clinician's chosen format, with suggested CPT and ICD-10 codes the clinician can change
- [ ] Every line editable; one tap copies the whole note for any EHR
- [ ] Nothing leaves Ferry until the clinician taps Approve

**P0-7 Scanning** (R7–R9)
- [ ] Scan insurance card front and back (S5), insurer letters and EOBs (S16)
- [ ] Person confirms the read details before they save; blurry or cropped scans ask for one retake
- [ ] Photos never saved to the phone's photo library; deleted from Ferry once details save

**P0-8 Claims from approved notes** (R10)
- [ ] Given a client with filing consent and insurance on file, when the clinician approves a note, then a claim is built from the note's codes and the fee schedule and filed via Stedi 837P (S8, S9)
- [ ] Every claim: client as payee, CLM07 = C, CLM08 = N (existing property test)
- [ ] No out-of-network benefit (S7) blocks filing and tells both people why
- [ ] The existing 16-state loop runs unchanged: 277CA, 276/277 polling, timers (S10, S13)

**P0-9 Client tracker** (R12)
- [ ] Trip list and detail with the brand chips and timeline (S12); every letter sent is attached
- [ ] Client never sees session notes (test)
- [ ] One notification per state change; SMS carries a link only

**P0-10 Letters** (R11)
- [ ] Insurer request (277 info request, scanned letter, denial code) opens a task for the clinician with a drafted letter built from progress notes only, citing which notes it used
- [ ] Clinician edits and approves; letter goes by the claim's route (electronic, fax via Sinch, or mail)
- [ ] One appeal template for the top denial reasons at launch

**P0-11 Privacy and security**
- [ ] Every existing invariant in `CLAUDE.md` holds, except the fee rules this PRD replaces
- [ ] Envelope encryption (S2b) before any real client data
- [ ] No real client data on any service until its BAA is signed (AWS, host, Stedi, Twilio, Sinch)
- [ ] Client data never used for model training; audio via the AWS BAA only

### P1: fast follows (target: within 4 weeks of launch)

- **Store apps.** iOS and Android apps (Expo) with the native document scanner, on the same API. Launch uses the installable web app (D4).
- **Upload a recording.** Plus direct capture from a telehealth tab on the computer.
- **Learns your style.** Note wording adapts from the clinician's edits.
- **Group plan.** One bill, shared formats, add and remove clinicians.
- **Yearly price.** About $40 a month billed yearly (D1).
- **Backlog filing.** Scan old superbills from before the clinician joined and file those still within timely-filing limits.
- **Misdirected payment.** If the insurer pays the clinician, send the refund-to-client letter (S22).

### P2: design for, don't build

- Direct push into EHRs (SimplePractice, TherapyNotes). Keep the note model format-neutral.
- Public payer scorecard (S27). Keep claim events complete.
- State regulator complaints (S23).
- PT and chiropractic templates. The claim model is already a full CMS-1500.
- Clients of non-member therapists (D3).

## Success metrics

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

## Open questions

| # | Question | Who | Blocking? |
|---|---|---|---|
| D1 | Exact monthly price and yearly option ($50 placeholder; suggest $49, yearly ~$40/mo) | Ryan | Before pricing page ships (Oct 4) |
| D2 | What gets cut to fit this into Nov 17 (recommendation below) | Ryan | Yes, by Sep 30 |
| D3 | Clients of non-member therapists: invite link only? | Ryan | No (Oct 1) |
| D4 | Launch the phone experience as an installable web app (camera and mic work) and ship store apps as P1? Recommended: store review for a health app with recording can take weeks | Ryan | Yes, by Sep 30 |
| Q-L1 | Wording for the clinician's authorization to file under their NPI with AI-drafted content | Attorney (F4) | Yes, before real claims |
| Q-L2 | Recording consent in all-party-consent states (e.g. CA, FL, WA): is the in-app client consent enough? | Attorney | Yes, before real recordings |
| Q-L3 | Letters draw only on progress notes, never psychotherapy notes: confirm the line and how the UI keeps them apart | Attorney | Yes, before letters go live |
| Q-L4 | Can marketing say "HIPAA compliant"? Prefer "signed BAA on every plan" until counsel agrees | Attorney | No |
| ~~Q-E1~~ | Resolved 2026-09-27 by Ryan: all PHI runs on AWS under the AWS BAA, and session notes come from **AWS HealthScribe** (see Decisions) | — | — |
| Q-E2 | Where clients' sessions come from when the clinician's EHR schedules them (manual add at launch) | Engineering | No |

## Decisions

- **2026-09-27, Ryan: AWS for everything that touches client data, and AWS HealthScribe as the scribe.** HealthScribe is HIPAA-eligible under the AWS BAA, streams live over the AWS SDK for JavaScript, writes a transcript and a clinical note to our own S3 bucket, and AWS does not retain the audio or train on it. It runs in **us-east-1 only**, so the whole PHI stack (ECS Fargate, RDS, S3, KMS, Bedrock, SES, HealthScribe) lives in us-east-1. Note templates map as: DAP → `DAP`, BIRP → `BIRP`, SOAP → `BEHAVIORAL_SOAP`, intake → `HISTORY_AND_PHYSICAL`; `GIRPP` and `SIRP` come free. A session can stream up to 2 hours and be resumed within 5 hours with the same session id, which is how an interrupted recording continues. HealthScribe returns no billing codes, so CPT and ICD-10 suggestions come from Claude on Bedrock, validated against code tables. Dictation and typed notes also go through Claude on Bedrock. The browser cannot hold HealthScribe's signed HTTP/2 stream, so audio goes phone → our server over a WebSocket → HealthScribe. HealthScribe's S3 output is imported, sealed, and deleted from S3.
  Sources: [HealthScribe streaming](https://docs.aws.amazon.com/transcribe/latest/dg/health-scribe-streaming.html), [note templates](https://docs.aws.amazon.com/transcribe/latest/APIReference/API_streaming_ClinicalNoteGenerationSettings.html), [HealthScribe FAQs](https://aws.amazon.com/healthscribe/faqs/).

## What this changes in the existing plan

This is the review of redundancy. The claims engine carries over almost entirely; the patient-fee and provider-invite work mostly goes away.

| Existing slice | Change | Why |
|---|---|---|
| S11b card on file, S20 fee events | **Replace** with Stripe subscriptions | No per-claim fee exists anymore |
| S19 Autopilot | **Drop** | The membership is the unlimited plan |
| S11 provider action link, S24 provider light account | **Replace** with the clinician account (P0-3) | The clinician is now the customer, not someone we invite |
| S15 records requests | **Merge into letters (P0-10)** | The notes are already in Ferry; no request to an outside provider |
| S4 superbill extraction | **Demote to P1 (backlog filing)** | Members' claims come from the note, not a superbill. Keep the vision pipeline; S5 cards and S16 letters reuse it |
| S11c landing page and waitlist | **Becomes P0-1 homepage** | Same slot, new page |
| S23 regulator complaints, S26 registration packets, S27 scorecard | **Defer to P2** | Already first in the founder's cut order |
| S3b consent | **Expand** with recording consent | New consent type, same record format |
| New work | Capture, notes, clinician profile, subscription billing, invite flow | About 6–8 new slices |
| `CLAUDE.md` fee invariant | **Rewrite** after D1/D2 | It describes the deleted $9 fee |

## Timeline

- **Today (Sep 27, Day 7):** S1–S3 done of 15 Week-1 slices. The plan freezes features on Oct 11.
- **Hard dates:** launch Tue Nov 17; Day-60 review Thu Nov 19. Store review, the Stedi production enrollment, BAAs and A2P 10DLC SMS registration are the long-lead items, and none are code.
- **Recommended phasing (D2):**
  1. **Sep 28 – Oct 18 (build):** finish the claims core (S2b, S10, S3b, S3c, S6, S6b, S5, S7, S8, S9, S12, S13); build capture, notes, clinician profile, subscriptions, homepage. Move the feature freeze from Oct 11 to Oct 18.
  2. **Oct 19 – Nov 1 (letters and hardening):** letters (S14, S16, S17 merged), notifications (S18), deploy (S21b), hardening (S28). Real data only once BAAs are signed.
  3. **Nov 2 – Nov 15 (beta):** 10 paying clinicians on the real stack, weekly fixes only.
  4. **Nov 17:** open sign-up.
