# Sprint tasks — slices with acceptance criteria

Replanned 2026-09-27 for the clinician membership in `docs/prd.md`. Companion to `architecture.md` (design) and `60-day-sprint.md` (dates and metrics). One slice per Claude Code session, in the execution order below. A slice is done when every acceptance criterion holds, `bun run test`, `bun run typecheck` and `bun run lint` are green (plus `bun run test:e2e` for any slice with e2e acceptance), its box here is ticked, and one local commit is made.

Slice ids follow build order, not number order. N0–N17 are new work. S-ids are slices from the 2026-09-17 plan that survive, marked `modified` or `merged`; the ones that did not survive are listed under "Replaced, merged, dropped and deferred". Every slice lists **Depends on**, **Fixture path** (how it is proven with no vendor account) and **Founder blockers**.

## Where things stand (Sun Sep 27, Day 7)

- Done: S1 (Postgres) and S2 (multi-user data model, whose one-owner tenancy N2a and N4 rework). S3 (sign-in) is open only for the 2-minute passkey Touch ID check.
- 154 tests in 17 files, typecheck and lint green on `main`.
- None of the clinician product exists yet (clients, capture, notes, membership, phone app), and the claims-engine parts the PRD keeps (state machine, encryption, filing, jobs) are not started. The per-claim fee was never built, so dropping it changes documents only.
- Today's founder decisions are in: AWS HealthScribe for in-room recording with all PHI on AWS us-east-1; transcription data deleted on import or erased at 24 hours with per-record key destruction; the patient plan and its subscription add-on deleted; a $50/month clinician membership whose price lives in config (`PRICING`).

## Resolved design points

These hold across slices; the slice text assumes them.

1. **Access model.** It is defined in N2a before any repo changes shape, and enforced in data by N4.
   - Tables and scope lists:
     - consents split into clinician_consents and client_consents (CLIENT_SCOPED)
     - clients is CLIENT_SELF
     - tasks.client_id is nullable, with a CHECK that client-audience tasks have one
     - claim_events is CLIENT_SCOPED
     - billing_events is GLOBAL (ids only)
   - Client-triggered writes into the tenant go through InviteCtx (acceptInvite only) or through jobs carrying the tenant id.
   - Cross-tenant sweepers and ticks find ids through resolvers.ts.
2. **Gate A without the refactor.** The phone spike no longer waits for the access-model refactor:
   - N3a (audio core and relay) depends only on N1.
   - S18a and N3b add their public paths to today's proxy matcher; N2b folds them into PUBLIC_PATHS.
   - N3b's dev pages need no sign-in: they are public only in the dev tier and only with the per-run key k, and relay tokens bind to {captureId, devRunId}.
3. **Transcript keys.**
   - Per-record keys live outside Postgres (EphemeralKeyStore: a local key directory in dev; DynamoDB with no point-in-time recovery or backups in AWS).
   - Scan fields use the same 24-hour keys, so unconfirmed scans crypto-shred on their own.
   - Side copies are closed:
     - external_calls keeps only hashes, sizes, timing and status for model calls
     - job payloads are ids only, and failures record only the error name
     - note evidence stores segment ids
     - 'use cache' is banned on PHI paths
   - Tests: decryptedDump(tenant) plus rawDump, including the pgboss schema, at +24h (N8, N9b, N12, N14, N17).
4. **Deploy tiers.** FERRY_DEPLOY_TIER = dev | prelaunch | staging | prod, separate from NODE_ENV.
   - Every entrypoint (Next, worker, relay) calls bootProcess() first, and it checks vendors by tier:
     - prelaunch: every vendor off; public pages only
     - staging: live, test or off; never fixture or local
     - prod: live for every vendor, with off allowed only for sms and fax
   - Prod runs in prelaunch until Gate E, then prod tier with a beta allow-list until open sign-up.
   - Unhandled errors print only the error name, in every process.
5. **Time.**
   - Timers are rows in a timers table with UNIQUE(subject, kind); a tick job fires those due at clock.now().
   - clock.now() adds a dev-only offset row, so Next, the worker, the relay and CLI scripts share one fake clock (clock:advance).
   - pg-boss startAfter is never used for timers, which makes every fake-clock criterion testable.
6. **Relay.** It is built on the `ws` package, so vitest can run it in-process under Node and `bun run relay` runs it under Bun.
7. **Dictation.** Dictation streams through the same relay to Amazon Transcribe Medical streaming (transcript only, same SDK, same BAA), capped at 5 minutes. Claude on Bedrock turns the text into the note, matching docs/prd.md:176. HealthScribe is used only for in-room recording.
8. **Insurer traffic.**
   - Nothing reaches an insurer without clinician approval, except:
     - 270 eligibility, after both consents; no clinical content
     - 276 status checks
     - resubmissions that change no clinical field (tested by diff)
   - Copy note works after Approve.
   - A no-insurer-traffic test spies on the clearinghouse, fax and letter senders.
9. **Consent withdrawal.** One rule per state:
   - Filing consent withdrawn: draft and ready claims are canceled; submitted and later states continue; no void is sent.
   - Recording consent withdrawn: an active recording closes within 5 seconds through Postgres NOTIFY to the relay.
10. **Letters and read-only.** A read-only clinician can draft, approve and send letters for claims filed before the lapse. Clients see letter metadata only.
11. **Paper channels.**
    - Member-form claims wait in 'ready' until the clinician marks them mailed, or a fax confirms (FaxSender, from S14).
    - Staff never download PHI papers.
    - portal_queue is dropped for beta.
12. **Build order.** Entitlements (N6) land before any capture, approve, file or letter code. D1 (Oct 4) and the homepage (Oct 1) keep their PRD dates.
13. **Merged slices.** S25 and S21 are merged, but their checks survive:
    - 90837 on a 48-minute session blocks Approve (N9a/N9b)
    - GT for payers that require it (S8)
    - PRD metrics, including Goal 5, on /ops/metrics (S29)
14. **Phone testing.** Caddy plus a cloudflared quick tunnel, refusing to start unless FERRY_DATA_CLASS=synthetic. The QR code carries a per-run key.
15. **Staff access.** StaffCtx sees cross-tenant ids, kinds, ages and counts only. repos/ops.ts, staffActFor and `tasks:list --staff` arrive in S9, where the first staff tasks do. `identity:verify` arrives in S6.
16. **Legal texts.** Legal texts are versioned files with placeholder front matter.
    - assertLiveLegal keeps live submission, live recording, real letters and prod onboarding shut until the attorney's text lands.
    - A consent to an older text version is stale until re-consent.
    - preflight:real-data (Gate E) checks every beta clinician's and client's consents.
17. **Test tooling.** It all lands in N1:
    - Playwright, fast-check, axe, happy-dom, Testing Library
    - vitest include widened to .tsx and infra
    - a ferry_e2e_test database and the outbox helper
    - test:e2e joins the done-definition for any slice with e2e acceptance
18. **Oversized slices split.** N2 → N2a/N2b, N3 → N3a/N3b, N7 → N7a/N7b, N9 → N9a/N9b, S28 → S28a/S28b.
19. **Dependencies loosened.**
    - S28a/b and S29 no longer wait on AWS; only their CloudWatch wiring does.
    - S13 and N15 both build on S10's openTask, so neither blocks the other.
20. **Fixture scans.** The fixture LLM matches camera captures by a dev-tier-only fixtureCase field. Accuracy gates count only with a real model (F6).

Critic item rejected: 'pg_dump is keg-only and not on PATH.' False: /opt/homebrew/bin/pg_dump links to postgresql@17 17.11. The rest of that gap (the e2e harness, cross-process clock, test:e2e in the done-definition) is accepted.

## Gates

- **A (Sep 29–30):** phone mic evidence in docs/plans/capture-device-matrix.md; decides D4.
- **B (Oct 2):** isolation v2, column classification, raw-dump and crypto-shred tests green.
- **C (Oct 9, M1):** e2e/m1-thin-path.spec.ts green on fixtures.
- **D (Oct 17):** e2e/gate-d.spec.ts. It adds:
  - card scan with retake, eligibility, fake-media recording with a gap, and dictation
  - paid → confirm arrived → closed
  - trial → read-only → card added
  - raw dump after the run, and no third-party origins
- **E2 (Oct 29):** e2e/gate-e2.spec.ts covers letters, insurer mail, denials and appeals, notifications, cancel and export.
- **E (Nov 1):** E2 green, and preflight:real-data exits 0 on prod; otherwise the beta waits.

## Execution order

- Mon Sep 28: N0 Docs of record → N1 Safety rails, modes, tiers, tooling → N3a Audio core and relay. Ryan (optional): allow a private GitHub remote
- Tue Sep 29: S18a Installable shell → N3b Phone recorder and dev:phone → N2a Access model. Evening: Ryan's 15-minute iPhone/Android test fills the device matrix (Gate A)
- Wed Sep 30: N2b Public routes and deletions → N4 Tenancy data (test-first). Ryan: D2 (cuts plus the 12 PRD changes) and D4; start F1 LLC/EIN, F5 AWS Organization (BAA, Bedrock, HealthScribe, Transcribe Medical, quotas), F2 Stedi paid account and test key, F4 attorney
- Thu Oct 1: S3c UI foundation → S11c Homepage, /for-clients and legal pages in the prelaunch tier. Ryan: D3, preview domain and contact address
- Fri Oct 2: S2b Encryption and column classification (test-first) → S3b Consents, re-consent and legal gates. Gate B: isolation v2, column classification, raw-dump and crypto-shred tests green
- Sat Oct 3: N5 Clinician Start free and onboarding → S10 State machine, timers table, dev clock, job hygiene, e2e harness (test-first)
- Sun Oct 4: N6 Membership billing (test-first entitlements) → S6b Payer directory and enrollments. Ryan: D1 price, D5 recording cost, F7 Stripe test keys
- Mon Oct 5: N7a Clients, invites, contact-bound acceptance → N7b Client welcome and insurance
- Tue Oct 6: S4 LLM provider with hash-only call log and Tax ID guard → N8 Encounters, typed capture, 24-hour erasure (test-first). F6 key may be added after S4
- Wed Oct 7: N9a Note model and code rules (test-first) → N9b Notes service and screen
- Thu Oct 8: S8 Claim from note and 837P (test-first) → S9 Submission, channels, member form, staff ops
- Fri Oct 9: N10 Auto-file on approve → S12 Client tracker → Gate C / M1 thin path green. Ryan: F13 beta clinician NPIs and payer mix; Stedi production and per-NPI enrollments submitted (needs F1)
- Sat Oct 10: N11 Scribe and dictation integration → N12 Capture relay
- Sun Oct 11: N13 Record and dictate (M2) → S6 NPPES and identity:verify. Evening: Ryan's 10-minute device test of the real product path on dev:phone
- Mon Oct 12: S7 Eligibility and out-of-network gate → S5 Card reading
- Tue Oct 13: S4b Scan camera → S13 Status polling (first to slip)
- Wed Oct 14: S21a Infrastructure as code, AI opt-out, SES, boot checks. Evening: Ryan's photo-library and timed client-welcome checks
- Thu Oct 15 – Fri Oct 16: buffer for slips and phone-test fixes; S21b provisions staging and a prelaunch prod the day F5 lands (Oct 16 at the latest) and runs the scribe:eval live pass
- Sat Oct 17: N14 Freeze walkthrough (Gate D)
- Sun Oct 18: fixes from Gate D only. FEATURE FREEZE
- Mon Oct 19: S14 Letter engine
- Tue Oct 20 – Wed Oct 21: N15 Letters from progress notes with citations
- Thu Oct 22: S17 Denials and the top-reasons appeal template
- Fri Oct 23: S16 Insurer letters and EOB scans. Ryan: attorney's final texts due
- Sat Oct 24: S18 Notifications
- Sun Oct 25: S28a Row-level security
- Mon Oct 26: S28b Limits, export, deletion, audit
- Tue Oct 27: N16 Vendor cutover, launch gating and preflight:real-data (reruns as keys land)
- Wed Oct 28: S29 Ops metrics, exceptions queue, alerts
- Thu Oct 29: N17 Post-freeze walkthrough (Gate E2)
- Fri Oct 30 – Sat Oct 31: buffer; staging walkthrough on synthetic data; beta clinicians re-consent to final texts; F11 icon/logo in; F15 allow-list set
- Sun Nov 1: Gate E. preflight:real-data exits 0 on prod, then prod moves from prelaunch to the prod tier with the beta allow-list
- Nov 2 – 15: beta with 10 paying clinicians on the real stack, fixes only
- Tue Nov 17: launch (FERRY_OPEN_SIGNUP=1). Thu Nov 19: Day-60 review

## Load, slip order and the never-cut rule

- 35 slices Sep 28–Oct 14, about 2.1 a day. S1–S3 landed in one day on Sep 17, but nothing has merged in 10 days, so the pace is unproven.
- Oct 15–18 is buffer, holding S21b and the Gate D walkthrough.
- 10 slices Oct 19–29, then 2 buffer days before Gate E.

Slip order: it moves dates or trims conveniences and never removes the only proof of a P0 checkbox.
1. S13 moves into the buffer or to Oct 19–22 (no real claims before beta; E2 still covers it).
2. N12 resume within 5 hours. A drop ends the capture and imports what was captured; gaps and 'Dictate the rest' stay.
3. S4b live viewfinder, only if the Gate A Android row shows the file input leaves no gallery copy. S5's server-side one-retake verdict stays.
4. S6 automatic name-match UI. The NPPES lookup and prefill, check digit, deactivated or non-behavioral block, and identity:verify stay.
5. S6b down to the beta clinicians' top 8 payers.
6. S16 EOB amount extraction. Insurer mail is still scanned, classified and routed; paid comes from the 277 or the client's confirmation.
7. S29 dashboards and non-safety alerts to beta week. Erasure-lag and purge-overdue alerts already ship in N8 and N12.

Never cut: every slice not named in the slip order, including S3b, S28a and S28b.

## Blocked on the founder

Nothing here is code. Keys go into `.env.local` by hand; Claude never handles the values. Every vendor runs on a fixture until its item lands, and each account flips one setting.

| # | Item | Needed by | Unblocks |
|---|---|---|---|
| F1 | LLC registered + EIN | Start Sep 30 | Stedi production, AWS and Stripe live, every BAA, SMS A2P registration |
| F2 | Stedi: upgrade to a paid account (MFA + BAA click-through), **test** API key as `STEDI_API_KEY`; production enrollment per beta clinician NPI × payer | Test key Sep 30; enrollments submitted Oct 9 (can take up to 30 days) | S7 and S8 test mode, S9, N16; electronic filing for beta clinicians |
| F3 | SMS: Twilio Security/Enterprise BAA plus A2P 10DLC (1–3 weeks, needs the EIN and live privacy and terms pages), or AWS End User Messaging | Mid-October, or the beta runs email-only | S18 SMS, phone-only invites |
| F4 | Attorney engaged: terms, privacy, BAA, Q-L1 filing authorization, Q-L2 recording consent (all-party states, family sessions, guardians of minors), Q-L3 progress vs psychotherapy notes, Q-L4 marketing wording, client filing consent | Engage Sep 30; final texts Oct 23 | S3b wording, every live gate (`assertLiveLegal`), N16 |
| F5 | AWS Organization with staging and prod accounts, BAA in AWS Artifact, Bedrock (`us.anthropic.claude-sonnet-5`), HealthScribe and Transcribe Medical in us-east-1, quota increases (concurrent streams and post-stream note jobs), SES production access, a domain | Start Sep 30; live Oct 16 at the latest | S2b live keys, N11 live and scribe:eval, S21b, N16 |
| F6 | `ANTHROPIC_API_KEY` for synthetic-only real-model runs | Only after S4 lands (Oct 6); keep it empty until then | Accuracy runs in S4, S5, S16, N9b |
| F7 | Stripe account, test keys (test mode and test clocks) | Oct 4 | N6 test mode, N16 |
| F8 | Sinch Fax account + BAA (document storage off, 2FA on) | Before S14 goes live (Oct 19) | S14 fax, member-form fax |
| F9 | De-identified real insurance cards, EOBs and insurer letters (scored only through Bedrock) | Before the S5 and S16 accuracy runs (Oct 12, Oct 23) | S5, S16 accuracy on real documents; real superbills now wait for P1 backlog filing |
| F10 | ~~Postgres 17 running locally~~ Done 2026-09-17: 17.11 via Homebrew; `ferry_dev` and `ferry_test` created. Binaries at `/opt/homebrew/opt/postgresql@17/bin`. | done | S1 |
| F11 | `tokens.json` and logo files (app icon and mark) | Before beta (Oct 31); the prod tier refuses placeholder icons | S3c logo, S18a icons, N16 preflight |
| F12 | ~~Clarify "Stedi's CMS-1500 validator"~~ Resolved 2026-09-17: Stedi's claim edits run on every submission; there is no validate-only call. | done | — |
| F13 | Beta clinicians: names, NPIs and emails of the 10, and their clients' main insurers | Oct 9 | S6b payer verification, F2 enrollments, N16 |
| F14 | Mail route for letters: clinician print-and-mail (default) or a mail vendor that signs a BAA (question 4) | Before S14 (Oct 19) | S14 mail route |
| F15 | Beta allow-list emails (`BETA_ALLOWLIST`) | Nov 1 | N5 sign-up policy in the prod tier, N16 preflight |

### Founder checks and decisions by date

| When | What |
|---|---|
| Sep 28 (optional) | Allow a private GitHub remote (risk R1) |
| Sep 29 | Approve `brew install caddy cloudflared` (N3b) |
| Sep 29 evening | 15-minute phone test on iPhone (iOS 18.4+) and Android if available; fills `docs/plans/capture-device-matrix.md` (Gate A) |
| Sep 30 | D2 (the cuts and the 12 PRD changes below) and D4; start F1, F5, F2 and F4 |
| Oct 1 | D3; a preview domain and the contact address for "Talk to us" and "Join the beta" |
| Oct 4 | D1 price, D5 recording cost, F7 Stripe test keys |
| Oct 9 | F13; Stedi production and per-NPI enrollments submitted |
| Oct 11 evening | 10-minute role-play recording test on the real product path (N13) |
| Oct 14 evening | Photo-library check and timed client welcome, 3 runs, median under 120 s (S4b) |
| Oct 16 at the latest | AWS live (F5) |
| Oct 23 | Attorney's final texts (F4) |
| Before beta | F11 icon and logo; beta clinicians re-consent to the final texts |
| Nov 1 | Gate E go/no-go; F15 |
| Any time | S3 passkey Touch ID check (2 minutes) |

Open decisions: D1 price (Oct 4), D2 cuts and PRD changes (Sep 30), D3 clients of non-member therapists (Oct 1), D4 installable web app at launch (Sep 30), D5 recording cost vs price (Oct 4).

### Questions only Ryan can answer

1. **Recording cost vs price (D5).** At list price HealthScribe costs $0.10 a minute. A clinician who records 20 fifty-minute sessions a week costs about $430 a month, against a $50 membership. Options:
   - cap recorded hours
   - raise the price
   - make dictation the default
   - record with plain Amazon Transcribe plus Claude (about $26 to $43)
   The code keeps that swap to one file. The scribe measurement run (N11) checks quality and speed the day AWS lands.
2. **Free trial and real claims.** Should the free trial file real claims? Each one costs us money. Default: yes, one trial per NPI, only after the NPI identity check, with a cap on claims during the trial.
3. **Diagnosis codes.** Should clients see their own diagnosis code? Default: hidden.
4. **Letters by post at launch.** The clinician prints and mails them (default), or we pay a mail service that signs a BAA?
5. **Invite wording.** Is 'You have an invitation waiting on Ferry' OK? It must not mention therapy.
6. **Beta sign-ups.** Before Nov 2, the homepage's 'Start free' reads 'Join the beta' and opens an email to you. Which address?
7. **Clinicians who are also clients.** Someone who is both needs two email addresses at launch. OK?
8. **Identity check.** Who does the manual identity check before a new clinician's first real claim during beta? Default: you, with one command (`bun run identity:verify <npi>`).
9. **Draft notes and the model's first draft.** Your 2026-09-27 rule keeps approved notes as the record and erases transcripts at 24 hours. Should unapproved draft or failed notes, and the model's unedited first draft of an approved note (`generated_body`, which for a recording is HealthScribe's note), also be erased at 24 hours, or kept? N9b stores both sealed under the clinician's key; your answer decides whether the 24-hour erasure (N8) also covers them. Needed before N9b.
10. **De-identified data on staging.** Staging is synthetic only, and boot enforces it (N1). Should it ever admit de-identified data, for example F9 corpus runs? Default: no.

## PRD changes awaiting D2

Each has a default that gets built unless Ryan says otherwise. All 12 are pending. `docs/prd.md` changes only in a follow-up docs commit after Ryan answers; until then the PRD keeps its current wording, and so do the matching lines in `docs/spec.html` (homepage copy, the letter line in the Tech tab's Data list).

1. **Letters by fax or mail.** (pending) Letters an insurer asked for go by fax or mail, not 'electronic'. Stedi can't carry a reply to an insurer's request.
2. **What clients see of letters.** (pending) Clients see a list of letters sent (type, insurer, date), never the letter text or attached notes.
3. **Copy after Approve.** (pending) 'Copy note' works after Approve, matching 'nothing leaves Ferry until Approve'.
4. **Automatic benefits check.** (pending) Once a client consents to filing, Ferry automatically checks their out-of-network benefits with the insurer. It sends name, date of birth and member ID, nothing clinical. Along with claim status checks, it is the only insurer contact that happens without a click.
5. **Sign-up.** (pending) It uses an emailed link. Face ID or Touch ID is offered right after the first sign-in, because a brand-new account can't start with one.
6. **Invite by email for now.** (pending) Invites need the client's email until text messaging is live. Phone-only invites come with texting.
7. **Filing consent withdrawn.** (pending) If a client withdraws filing consent, claims not yet sent are stopped. Claims already at the insurer carry on to the end, and no cancellation is sent.
8. **Lapsed or canceled clinicians.** (pending) A clinician whose trial ran out, or who canceled, can still answer insurer letters for claims already filed.
9. **Clients under 18.** (pending) A parent or guardian accepts the invite and consents. The attorney confirms this as part of Q-L2.
10. **Homepage wording.** (pending)
    - Remove 'or on video' until telehealth capture exists (P1).
    - 'Unlimited notes and dictation' stays only if D5 doesn't cap hours.
11. **Paper claims.** (pending) When an insurer's electronic enrollment is still pending, the clinician prints and mails the claim form, or Ferry faxes it. Ryan never handles those papers.
12. **Milestone dates.** (pending) M1 moves from Oct 8 to Oct 9 and M2 from Oct 9 to Oct 11. The freeze, beta and launch dates don't move.

## Open risks

| # | Risk | Status |
|---|---|---|
| R1 | The repo has no git remote: every commit lives only on the founder's Mac. A lost or failed laptop loses the sprint, and CI for S21b needs a remote. | Accepted for now (2026-09-17). Fix is a private GitHub repo; the repo holds synthetic data only and `.env.local` is gitignored. Ryan may allow it any time from Sep 28. |

From the 2026-09-27 replan:

- **Pace.** 35 slices are planned for Sep 28–Oct 14 (about 2.1 a day), then a 4-day buffer, then 10 slices Oct 19–29. Nothing has merged since Sep 17, so this pace is unproven. If the buffer is gone by Oct 15, apply the slip order; it moves dates or trims conveniences and never removes a P0 proof.
- **Recording cost vs price (D5).** HealthScribe lists at $0.10/min, which is about $430/month for a clinician recording 20 fifty-minute sessions a week, against a $50 membership.
  - Ryan decides with D1 on Oct 4: cap recorded hours, raise the price, make dictation the default, or switch record mode to plain Transcribe plus Claude (about $26–43).
  - N11's optional note field keeps a switch inside one integration.
  - N12 meters minutes per tenant, and scribe:eval measures quality and cost the day F5 lands.
  - If hours are capped, the homepage's 'Unlimited notes and dictation' must change (home-claims and limits-vs-copy tests enforce this).
- **iPhone recording.** In an installed web app the mic can stop on screen lock, app switch or a call, and Wake Lock needs iOS 18.4+.
  - Evidence arrives Sep 29 (N3b) and again Oct 11 (N13).
  - Gap marking and 'Dictate the rest' carry what's lost.
  - If installed mode fails, launch records in a Safari tab. Dictation and typing work on their own, so the beta isn't blocked.
- **Founder dates that decide Nov 2.**
  - F1 LLC/EIN: start now.
  - Stedi paid account and test key: by Sep 30.
  - Stedi production enrollment for each beta clinician's NPI with each payer: submitted by Oct 9 (can take up to 30 days). Claims to pending payers fall back to member-form mailing.
  - F5 AWS Organization with BAA, Bedrock, HealthScribe, Transcribe Medical and quota increases: by Oct 16.
  - Attorney texts (Q-L1, Q-L2 including guardians of minors, Q-L3, BAA, terms, privacy, consents): by Oct 23.
  - Beta clinicians re-consenting to the final texts: by Nov 1.
  Until each arrives, work runs on fixtures and the live gates stay shut.
- **Erasure correctness.** Crypto-shredding holds only if per-record keys and plaintext never land in Postgres, backups, job tables or logs.
  - S2b puts keys in an EphemeralKeyStore.
  - S4 stores hashes only for model calls; S10 keeps job payloads id-only; N11 stores evidence as ids.
  - S21a asserts that the key table has no point-in-time recovery or AWS Backup selection, and that the HealthScribe bucket has versioning off and a 1-day expiry.
  - decryptedDump tests at +24h (N8, N9b, N12, N14, N17) and the S21b restore drill prove it.
  - An unforeseen new side store would still leak. The column-classification test catches new columns, but not new external stores; each new vendor gets reviewed against this list.
- **Console scrubbing.** N1 replaces console.error in production to stop Next from printing error messages and stacks. A Next upgrade that logs through another path could bypass it; S21b's logs:scan and N1's scrub.spec.ts catch that.
- **Tenancy rework.** N2a, N2b and N4 re-key every S2 repo and test and delete the patient MVP pages. Until N5 and N7a there is no product UI beyond the homepage and onboarding; this is intentional and lasts about 5 days.
- **RLS late in the schedule.** S28a (Oct 25) adds database roles and FORCE RLS a week before Gate E. It can break resolver, webhook, sweeper or invite paths; its tests cover each one explicitly, and N17 reruns on the ferry_app role.
- **Vendor limits that change P0 wording (D2).**
  - Stedi accepts only unsolicited 275 attachments, so P0-10's 'electronic' route is removed for insurer-requested letters.
  - There is no mail vendor, so launch mail is clinician print-and-mail.
  - Stedi 276/277 has no test mode, so status polling launches tested only on fixtures.
  - Stedi's eligibility mocks have no mental-health or out-of-network data, so the gate is tested on hand-written 271s.
- **Bedrock.** Sonnet 5 has no structured outputs on Bedrock, so S4 uses forced tool calls plus zod and one retry. The us.anthropic.claude-sonnet-5 inference profile can route to other US regions; the attorney should confirm this, or the model should be pinned to a single region.
- **HealthScribe quotas.** Defaults are reported as 10 concurrent streams and 1 concurrent post-stream note job. Without an increase requested with F5, notes queue at the top of the hour and miss the under-5-minute goal. Dictation uses Transcribe Medical, so it doesn't consume the HealthScribe job quota.
- **Relay.** The relay is a third process. It needs WebSocket routing (S21a), a per-capture lease (N12), and the consent kill switch over Postgres NOTIFY; a missed notification is caught by the per-connect re-check.
- **SMS.** Twilio's BAA needs a Security or Enterprise contract. A2P registration takes 1–3 weeks and needs the EIN plus live privacy and terms pages. Plan an email-only beta (SMS off, allowed in the prod tier) unless F1 and F3 land by mid-October. Invites need an email until then.
- **Impersonation and trial abuse.**
  - Anyone could sign up with someone else's NPI. N5 makes NPI unique per account, and liveFilingAllowed needs an NPPES name match plus identity:verify.
  - Prod admits only BETA_ALLOWLIST until Nov 17.
  - No-card trials that file real claims cost Ferry money; decide whether to cap them (S28b).
- **Phone testing tunnel.** dev:phone exposes the dev server through a public cloudflared tunnel. It refuses to start without FERRY_DATA_CLASS=synthetic and outside the dev tier, and /dev routes need a per-run key. No real audio ever goes through it.
- **Preview homepage.** It needs a domain and a host. The prelaunch tier serves only public pages with every vendor off and stores nothing, so any host is safe.
- **Stale docs until N0 lands.** CLAUDE.md, architecture D1/D10/§4/§5/§6/§8/§9, 60-day-sprint.md, FERRY_BRAND §1/§12.3 and spec.html (48 minutes shown as 90837; pg-boss and extraction called 'built') all describe the old product or overstate progress. docs/prd.md keeps its current wording until Ryan answers D2.
  - Status: closed by N0 except `docs/prd.md` and the spec.html homepage copy and Tech-tab letter line, which wait for D2.
- **Still open for Ryan.** The S3 passkey Touch ID check (2 minutes). F11 app icon and logo: the prod tier refuses placeholder icons, and FERRY_BRAND §12.5 forbids improvising a logo.

## P0 coverage

One row per `- [ ]` line between `### P0` and `### P1` in `docs/prd.md` (41 today). Boxes are numbered by their order within their group: P0-5.3 is the third box under P0-5. End-to-end proof: Gate C (`e2e/m1-thin-path.spec.ts`), Gate D (`e2e/gate-d.spec.ts`) and Gate E2 (`e2e/gate-e2.spec.ts`).

| P0 | Requirement | Slices | Proven by |
|---|---|---|---|
| P0-1.1 | Homepage per `docs/spec.html`: banner, hero, how it works, security, pricing, questions, footer | S11c | home-copy.test.ts, home-claims.test.ts, e2e/home.spec.ts |
| P0-1.2 | Pricing shows 7-day trial, membership ($50 placeholder, D1), custom groups; no per-claim fee anywhere | S11c | pricing-grep.test.ts, home-copy.test.ts |
| P0-1.3 | At 390 px wide: one column, no sideways scroll | S11c | e2e/home.spec.ts |
| P0-1.4 | No reviews, user counts or testimonials | S11c | banned-patterns.test.ts |
| P0-2.1 | Given a new visitor, when they tap "Start free", then sign-up asks for email only (magic link or passkey;… | N5 | e2e/onboarding.spec.ts, e2e/passkey.spec.ts, clinician.test.ts, signup-policy.test.ts |
| P0-2.2 | BAA and terms accepted at sign-up, stored with a content hash (S3b pattern) | S3b, N5 | consent.test.ts, legal-gate.test.ts (S3b); clinician.test.ts (N5) |
| P0-2.3 | Day 5 and day 7: one reminder each; card requested at day 7 via Stripe; no card means read-only, nothing… | N6 | entitlements.test.ts, reminders.test.ts, billing.test.ts |
| P0-2.4 | Cancel anytime from Account; takes effect at period end | N6 | entitlements.test.ts, e2e/billing.spec.ts |
| P0-3.1 | NPI checked against NPPES (S6); Tax ID sealed and shown as last four | S6, N5 | nppes.test.ts, identity-verify.test.ts (S6); clinician.test.ts, raw-dump.test.ts, log.test.ts, e2e/onboarding.spec.ts (N5) |
| P0-3.2 | Clinician sets session fee per CPT code once; claims use it | N5, S8 | fee-schedule.test.ts (N5); from-note.test.ts (S8) |
| P0-3.3 | Clinician authorizes Ferry to file non-assigned claims under their NPI (wording from attorney, Q-L1) | S3b, N5 | consents.test.ts, legal-gate.test.ts (S3b); live-filing.test.ts, clinician.test.ts (N5) |
| P0-4.1 | Clinician adds a client by name and phone or email; the client gets a link with no health details in it | N7a | clients.test.ts, invite.test.ts, invite-page.test.ts, accept.test.ts, no-phi.test.ts |
| P0-4.2 | Client consents separately to (a) recording and (b) filing, each timestamped; either can be withdrawn | S3b, N7b | consents.test.ts, withdraw-notify.test.ts, minor.test.ts (S3b); consents.test.ts, e2e/invite.spec.ts (N7b) |
| P0-4.3 | Recording controls are disabled for a client without recording consent; dictation and typing still work | N8, N13 | captures.test.ts (N8); e2e/record.spec.ts (N13) |
| P0-5.1 | In-room recording on phone or computer; dictation; typed rough notes | N8, N11, N13 | captures.test.ts (N8); scribe-fixture.test.ts, scribe-live.test.ts (N11); e2e/record.spec.ts, e2e/dictate.spec.ts (N13) |
| P0-5.2 | Interrupted recording keeps what was captured and marks the gap | N12, N13 | intervals.test.ts, abandon.test.ts (N12); e2e/record.spec.ts, ring-buffer.test.ts (N13) |
| P0-5.3 | Transcript retention (Ryan, 2026-09-27): HealthScribe's S3 transcript and note files are deleted the moment… | S2b, N8, N12 | shred.test.ts (S2b); erasure.test.ts (N8); import.test.ts, erasure.test.ts (N12) |
| P0-5.4 | Erasure is enforced three ways: a per-transcript job at `created + 24h`, a sweeper every 15 minutes that… | N8, S21a | erasure.test.ts, erasure-alert.test.ts (N8); infra/stack.test.ts (S21a) |
| P0-5.5 | Erasure destroys the transcript's data key, so copies in RDS automated backups are unreadable… | S2b, N8, S21b | shred.test.ts (S2b, extended in N8); restore drill in docs/runbook.md (S21b) |
| P0-5.6 | Audio streams through AWS HealthScribe and is never written to our disk or S3; HealthScribe's transcript and… | N12, N13 | no-audio.test.ts, import.test.ts (N12); no-persist.test.ts, e2e/record.spec.ts (N13) |
| P0-6.1 | Note in the clinician's chosen format, with suggested CPT and ICD-10 codes the clinician can change | N9a, N9b, N13 | note-model.test.ts, psychotherapy.test.ts, code-issues.test.ts, format.test.ts, icd10.test.ts (N9a); note-format.test.ts, e2e/note.spec.ts (N9b); e2e/dictate.spec.ts (N13) |
| P0-6.2 | Every line editable; one tap copies the whole note for any EHR | N9b | notes.test.ts, e2e/note.spec.ts |
| P0-6.3 | Nothing leaves Ferry until the clinician taps Approve | N9b, N10 | notes.test.ts, traffic.test.ts (N9b); no-insurer-traffic.test.ts (N10) |
| P0-7.1 | Scan insurance card front and back (S5), insurer letters and EOBs (S16) | S5, S16 | scans.test.ts (S5); mail.test.ts (S16) |
| P0-7.2 | Person confirms the read details before they save; blurry or cropped scans ask for one retake | S5, S4b | scans.test.ts (S5); quality.test.ts, e2e/scan.spec.ts (S4b) |
| P0-7.3 | Photos never saved to the phone's photo library; deleted from Ferry once details save | S5, S4b | scan-storage.test.ts, scan-expiry.test.ts (S5); no-persist.test.ts, e2e/scan.spec.ts, Oct 14 founder check (S4b) |
| P0-8.1 | Given a client with filing consent and insurance on file, when the clinician approves a note, then a claim is… | S8, S9, N10 | from-note.snapshot.test.ts, stedi-schema.test.ts (S8); submit.test.ts, channel.test.ts (S9); file-note.test.ts, filing-gate.test.ts (N10) |
| P0-8.2 | Every claim: client as payee, CLM07 = C, CLM08 = N (existing property test) | S8, S9 | clm-invariants.property.test.ts (S8, extended in S9); packet.test.ts (S9) |
| P0-8.3 | No out-of-network benefit (S7) blocks filing and tells both people why | S7 | eligibility.test.ts, eligibility-request.test.ts |
| P0-8.4 | The existing 16-state loop runs unchanged: 277CA, 276/277 polling, timers (S10, S13) | S10, S9, S13 | transition.test.ts, timers.test.ts, notify.property.test.ts, worker.test.ts (S10); submit.test.ts, map277ca.test.ts, rejections.test.ts (S9); map-status.test.ts, poll-timers.test.ts (S13) |
| P0-9.1 | Trip list and detail with the brand chips and timeline (S12); every letter sent is attached | S12, N15 | trips.test.ts, copy.test.ts, e2e/m1-thin-path.spec.ts (S12); letters.test.ts (N15) |
| P0-9.2 | Client never sees session notes (test) | S12, N9b, N15 | marker.test.ts, trips.test.ts (S12); marker.test.ts, ctx.test.ts (N9b); marker.test.ts (N15) |
| P0-9.3 | One notification per state change; SMS carries a link only | S10, S18 | notify.property.test.ts (S10); notifications.test.ts, no-phi.test.ts, channels.test.ts (S18) |
| P0-10.1 | Insurer request (277 info request, scanned letter, denial code) opens a task for the clinician with a drafted… | S13, S16, S17, N15 | info-request.test.ts (S13); mail.test.ts (S16); appeal-draft.test.ts, denials.test.ts (S17); sources.test.ts, citations.test.ts, letters.test.ts (N15) |
| P0-10.2 | Clinician edits and approves; letter goes by the claim's route (electronic, fax via Sinch, or mail) | N15, S14 | letters.test.ts, letters-readonly.test.ts, letters-live.test.ts (N15); pdf.test.ts, fax.test.ts, mail.test.ts, letters.test.ts (S14) |
| P0-10.3 | One appeal template for the top denial reasons at launch | S17 | classify-denial.test.ts, appeal-draft.test.ts |
| P0-11.1 | Every existing invariant in `CLAUDE.md` holds, except the fee rules this PRD replaces | N0 plus every slice | N0 stale-term grep; each slice's own list (log.test.ts, boundaries.test.ts, schema.test.ts, columns.test.ts, isolation.test.ts, ctx.test.ts) |
| P0-11.2 | Envelope encryption (S2b) before any real client data | S2b, N16 | seal.test.ts, columns.test.ts, raw-dump.test.ts, blind-index.test.ts, tenant-key.test.ts (S2b); preflight.test.ts, data-class.test.ts (N16) |
| P0-11.3 | No real client data on any service until its BAA is signed (AWS, host, Stedi, Twilio, Sinch) | N1, N16 | guard.test.ts, mode.test.ts, boot.test.ts (N1); preflight.test.ts, data-class.test.ts (N16) |
| P0-11.4 | Client data never used for model training; audio via the AWS BAA only | S4, S21a, N16 | anthropic.test.ts, bedrock.test.ts (S4); infra/stack.test.ts (S21a); preflight.test.ts (N16) |
| P0-11.5 | Transcripts never reach logs, analytics, error reports or Bedrock invocation logs (invocation logging stays… | N1, S4, S21a, S21b | log.test.ts, process-errors.test.ts, e2e/scrub.spec.ts (N1); external-calls.test.ts, log.test.ts (S4); boot.test.ts, infra/stack.test.ts (S21a); smoke:staging and logs:scan (S21b) |

## Replaced, merged, dropped and deferred

| Slice | Status | Was | Reason |
|---|---|---|---|
| S11 | replaced | Provider action link, SMS, channel selection | Replaced: The clinician account and in-app filing authorization move to N5; The hashed single-use link and assertNoPhi move to N7a (client invites); selectChannel and the packet.ts move go to S9. |
| S24 | replaced | Provider light account | Replaced by N5. The clinician is the paying customer, not a light account we invite. NPPES prefill moves to S6; per-patient learned defaults are dropped. |
| S11b | replaced | Stripe card on file | Replaced by N6: a Stripe subscription with a no-card trial. The metadata allow-list test carries over. |
| S20 | replaced | Fee events | Replaced by N6. computeFee, chargeFee, fee_events and fee reversal are deleted from the plan; none were ever built. |
| S15 | merged | Records requests | Merged into N15. The notes are already in Ferry, so a records request becomes a clinician letter task with cited progress notes. The payer checklist (date on every page, start/stop times, signature with credential) becomes a requirement on notes (N9b) and letter PDFs (S14). |
| S25 | merged | Payer scrubber rules | Merged: The time-based, add-on, intake and duration rules run before Approve (N9a/N9b); The per-payer telehealth POS/modifier rule (95 vs GT) lives in S6b PayerRules and S8; Testing-code unit logic is deferred. |
| S21 | merged | Funnel dashboard | Merged into S29. The metrics page shows the PRD success metrics, including Goal 5, instead of the old photo funnel. |
| S30 | merged | Pricing and legal pages | Merged. Versioned legal texts, hashes and re-consent go to S3b; pricing and the /legal pages go to S11c. There is no guarantee page. |
| S19 | dropped | Email inbox and provider SMS replies | Autopilot is deleted; the membership is the unlimited plan. This also removes the SES inbound-mail dependency and closes architecture §15 open question 2. |
| Patient MVP surface | dropped | — | Deleted in N2b: the dashboard, /plans, /claims/new, /claims/[id] and /edit (which showed the full Tax ID at src/app/claims/[id]/page.tsx:81); the superbill upload path, createClaimFromUpload and src/server/storage/local.ts with the documents table; src/lib/templates.ts, draftFollowUp and src/lib/ai.ts. Members' claims come from notes. |
| S4b anonymous drafts | dropped | — | The signed-out 24-hour anonymous capture funnel is dropped: clinicians are signed in, and clients arrive by invite. |
| S2 two-user superbill walkthrough criterion | dropped | — | Superseded by the three-actor isolation v2 test in N4. |
| portal_queue letter route | dropped | — | Portal uploads would need someone's payer-portal credentials and would put PHI PDFs in staff hands. Letters go by fax, or by clinician print-and-mail. Member-form claims go by fax or clinician mail. |
| Staff handling of member-form packets | dropped | — | Replaced by clinician print-and-mail or Ferry fax (S9, S14), so no PHI papers are downloaded to a staff machine. |
| S4-superbill | deferred | — | P1 backlog filing: SuperbillExtraction v2, the 95% superbill gate, CMS-1500 input and corpus case sb-11. S4 keeps only the LLM provider, the guard and the scorer. |
| S22 | deferred | — | P1 misdirected payment. Until then, misdirected raises a staff exception on /ops/exceptions. |
| S23 | deferred | — | P2 regulator complaints. The escalated state stays in the machine; until then it raises a staff exception, plus a second inquiry awaiting clinician approval. |
| S26 | deferred | — | P2 non-par registration packets. Per-NPI enrollment is tracked in S6b and routed around in S9. |
| S27 | deferred | — | P2 public payer scorecard. claim_events stays complete so it can be built later. |
| P1 Expo store apps | deferred | — | D4: the installable web app is the launch phone app; store apps come later on the same API. |
| P1 group plan, yearly price, learns-your-style, uploaded recordings, telehealth tab capture | deferred | — | PRD P1. Whether notes.generated_body and unapproved drafts are kept is founder question 9. Groups get 'Talk to us' on the homepage. The homepage drops 'or on video' until telehealth capture exists (D2 item 10). |
| P2 EHR push and filing for clients of non-member therapists | deferred | — | PRD P2 and D3. Launch has one-tap copy after Approve, and a public /for-clients invite-your-therapist page. |
| S25 testing-code unit logic | deferred | — | 96130–96137 unit rules come after launch; the psychotherapy time, intake and family rules ship in N9a. |
| In-browser Opus encoding | deferred | — | After launch. Raw 16 kHz PCM is about 115 MB per recorded hour on cellular, which is acceptable for beta. |
| Void requests after filing-consent withdrawal | deferred | — | P1, and only with clinician approval. At launch, withdrawal cancels draft and ready claims; submitted claims continue to closure (D2 item 7). |
| Phone-only client invites | deferred | — | Arrive with SMS verification in S18 once F3 lands; email is required until then (D2 item 6). |

S3 stays open only for the passkey Touch ID check.

## Done and open from the 2026-09-17 plan

Their full criteria are in git history (`git show c795a80:docs/sprint-tasks.md`).

### [x] S1 — SQLite → Postgres

Status: done 2026-09-17 · Plan: `docs/plans/slice-01-postgres.md`

Depends on: F10 (done)

Fixture path: local Postgres 17 (`ferry_dev`, `ferry_test`).

Founder blockers: none

### [x] S2 — Multi-user data model, scoped repos, service layer

Status: done 2026-09-17 · Plan: `docs/plans/slice-02-data-model.md`. Its one-owner tenancy is reworked by N2a and N4; its two-user walkthrough criterion is superseded by N4's isolation v2 test.

Depends on: S3

Fixture path: `ferry_test`; no vendor.

Founder blockers: none

### [ ] S3 — Auth: magic link + passkeys (code complete 2026-09-17; one manual check open)

Status: open only for the passkey check · Plan: `docs/plans/slice-03-auth.md`

Depends on: S1

Fixture path: email fixture writes magic links to `data/outbox/`; registration options verified by test.

Founder blockers: 2 minutes with Touch ID

- [ ] Add a passkey on `/account` and sign in with it. Registration options are verified by test and against the live server; the fingerprint step needs a person. Founder: 2 minutes with Touch ID, then tick this and the slice. (N5's `e2e/passkey.spec.ts` later automates this with a virtual authenticator.)

## Slices, in execution order

### [x] N0 — Docs of record: rewrite CLAUDE.md, sprint-tasks, architecture and schedule for the pivot

Scheduled: Mon Sep 28 · Status: new · Size: S · PRD: P0-11.1

Depends on: none

Fixture path: Docs only; checked by grep and awk.

Founder blockers:

- D2 by Sep 30: the cuts plus the 12 PRD changes; docs/prd.md is edited only after that
- Optional: allow a private GitHub remote (risk R1)

Why: Every session reads CLAUDE.md and docs/sprint-tasks.md first. Both still describe the patient product: CLAUDE.md 'What this is', the fee invariant, and 'After Day 21 (Oct 11)'. Until they change, each session builds against deleted rules.

#### Scope

Docs only; no code.

**CLAUDE.md**
- Apply claudeMdChanges verbatim.

**docs/sprint-tasks.md** (replaced with this plan)
- Every slice with scope, acceptance, dependsOn, fixture path and founder blockers.
- A P0 coverage table: one row per `- [ ]` line between `### P0` and `### P1` in docs/prd.md (41 today). Each checkbox is numbered by its order in its group (P0-5.3 is the third box under P0-5), and each row names the slices and test files that prove it:
  - P0-1.1–1.4 S11c
  - P0-2.1 N5; P0-2.2 S3b, N5; P0-2.3 N6; P0-2.4 N6
  - P0-3.1 S6, N5; P0-3.2 N5, S8; P0-3.3 S3b, N5
  - P0-4.1 N7a; P0-4.2 S3b, N7b; P0-4.3 N8, N13
  - P0-5.1 N8, N11, N13; P0-5.2 N12, N13; P0-5.3 S2b, N8, N12; P0-5.4 N8, S21a; P0-5.5 S2b, N8, S21b; P0-5.6 N12, N13
  - P0-6.1 N9a, N9b, N13; P0-6.2 N9b; P0-6.3 N9b, N10
  - P0-7.1 S5, S16; P0-7.2 S5, S4b; P0-7.3 S5, S4b
  - P0-8.1 S8, S9, N10; P0-8.2 S8, S9; P0-8.3 S7; P0-8.4 S10, S9, S13
  - P0-9.1 S12, N15; P0-9.2 S12, N9b, N15; P0-9.3 S10, S18
  - P0-10.1 S13, S16, S17, N15; P0-10.2 N15, S14; P0-10.3 S17
  - P0-11.1 N0 plus every slice; P0-11.2 S2b, N16; P0-11.3 N1, N16; P0-11.4 S4, S21a, N16; P0-11.5 N1, S4, S21a, S21b
  - End-to-end proof: Gates C, D and E2.
- A 'PRD changes awaiting D2' section: the 12 items in the approach, each marked pending. docs/prd.md itself changes only in a follow-up docs commit after Ryan answers.
- The F-table with needed-by dates, adding F13 (beta clinician NPIs and payer mix, Oct 9), F14 (mail route for letters) and F15 (beta allow-list emails, Nov 1).
- Gates A, B, C, D, E2 and E; the dated execution order; the slip order and the never-cut rule.
- S11, S11b, S15, S19, S20, S21, S24, S25 and S30 marked replaced, merged or dropped, with reasons. S3 stays open only for the passkey Touch ID check.

**docs/architecture.md**
- D1: clinician membership plus installable web app.
- D10: timers are rows in a timers table fired by a tick job, not pg-boss delayed jobs.
- §3 file table:
  - src/lib/ai.ts is replaced by src/server/integrations/llm (S4)
  - packet.ts moves to src/server/documents (S9)
  - templates.ts and src/server/storage/local.ts are deleted (N2b)
  - followups.ts becomes src/core/claim/timers.ts (S10)
- §4:
  - no chargeFee
  - requestRecords becomes openTask(audience clinician, kind letter)
  - submit fires on note_approved
  - cancel comes from the clinician, or from withdrawn filing consent while the claim is draft or ready
  - actors are clinician|client|system|staff
  - notify names its recipients
  - member_form claims wait in ready until mailed or faxed
- §5: the new table list.
- §6: the N2a access model, deploy tiers, a per-tenant data key, and per-record ephemeral keys outside Postgres.
- §8:
  - the subscription replaces the fee rule
  - the modeFor selector
  - the CMS-1500 PDF is fetched on demand for clinicians and never stored
- §9: primitive homes.
- §15: close OQ2.

**Other docs**
- docs/60-day-sprint.md: the definition of done and the metrics become the PRD success metrics (docs/prd.md:146); freeze Oct 18, beta Nov 2–15, launch Nov 17.
- docs/spec.html:
  - line 474 '90837 · 60 min', next to '48 min in the room' at line 467, becomes '90834 · 48 min'
  - the Tech tab stops calling pg-boss and extraction 'built'
  - homepage copy waits for D2 item 10
- FERRY_BRAND.md: add a §1 note that S3c drafts a §13 clinician amendment; flag §12.3 'Snapped and sent' for Ryan.
- tasks/todo.md: reset to N1, N3a, S18a.

#### Acceptance

- [x] Stale-term grep `grep -nE 'Autopilot|pay-when-paid|[$]9|Patient is the payee|Oct 11|Day 21' CLAUDE.md docs/architecture.md docs/sprint-tasks.md docs/60-day-sprint.md` matches only Decisions-log lines, rows marked dropped or replaced, the new plan's own 'Oct 11' dates (M2, N13) and N0 or S11c lines that quote the stale terms or this pattern; each remaining hit is listed in the commit message. (Reworded after review: the original wording excluded the new M2 date, so the box was met on intent; the hits are listed in 8902bd4.)
- [x] The number of `- [ ]` lines between `### P0` and `### P1` in docs/prd.md (41 today, counted with awk plus grep -c) equals the number of P0-n.k rows in the coverage table; the commit message records both counts
- [x] Every slice id the coverage table names exists as a heading in docs/sprint-tasks.md
- [x] Every open slice in docs/sprint-tasks.md has 'Depends on', 'Fixture path' and 'Founder blockers' lines (grep -c)
- [x] `grep -n 90837 docs/spec.html` shows no line pairing it with a session under 53 minutes
- [x] `git diff --stat` on the commit lists only .md and .html files
- [x] bun run test, typecheck and lint green

### [x] N1 — Safety rails, integration modes, deploy tiers, error scrubbing and test tooling

Scheduled: Mon Sep 28 · Status: done 2026-09-27 · Plan: `docs/plans/slice-n1.md` · Size: M · PRD: P0-11.1, P0-11.3, P0-11.5

Depends on: N0

Fixture path: Env-driven and local; no network call anywhere.

Founder blockers: Keep ANTHROPIC_API_KEY empty until S4 lands on Oct 6 (F6)

Why: This slice closes live gaps and adds primitives every later slice needs:
- src/lib/ai.ts:9 enables the direct Anthropic API whenever ANTHROPIC_API_KEY is set, with no synthetic or production check.
- .gitignore:44 ignores data/, so data/payers and data/codes would never be committed.
- There is no live/test/fixture selector (src/server/integrations/email/index.ts:22 is hard-wired to the fixture) and no notion of a deploy tier.
- src/server/log.ts covers only explicit log() calls; its `code` key accepts any string.
- vitest.config.mts includes only *.test.ts, so .tsx and infra tests would silently never run.
- Playwright, fast-check, axe and a DOM environment aren't installed.

#### Scope

**Data class and direct-API guard**
- FERRY_DATA_CLASS = synthetic | deidentified | real.
- src/server/integrations/llm/guard.ts `assertSyntheticDirectApi(env)` allows the direct API only for synthetic, and only in the dev tier.
- src/lib/ai.ts calls it until N2b deletes that file; S4 reuses it.

**Modes and tiers**
- src/server/integrations/mode.ts:
  - VENDORS: keys, ephemeralKeys, storage, email, sms, llm, scribe, billing, clearinghouse, nppes, fax
  - `modeFor(vendor)` reads FERRY_<VENDOR>_MODE = live | test | fixture | off; the default is fixture in dev
  - calling a vendor that is off throws VendorOff
- src/server/deploy.ts: FERRY_DEPLOY_TIER = dev | prelaunch | staging | prod. NODE_ENV=production without an explicit tier refuses to boot.
- src/server/boot.ts `bootProcess(name)` asserts the tier's vendor rules:
  - prelaunch: every vendor off
  - staging: live, test or off, and FERRY_DATA_CLASS=synthetic only
  - prod: live, or off only for sms and fax
  - dev: anything
  Every failure is named. src/instrumentation.ts register() calls it; the worker (S10) and relay (N3a) call it first.
- `assertDevTier()` for dev scripts (demo:seed, billing:simulate, clock:advance, dev:login, dev:phone): tier dev and a DATABASE_URL database ending _dev or _test.

**Error scrubbing**
- onRequestError in src/instrumentation.ts logs only the error name and digest.
- With NODE_ENV=production or FERRY_SCRUB_ERRORS=1, console.error and console.warn are replaced by a scrubber that prints error names only.
- bootProcess installs uncaughtException and unhandledRejection handlers that log the error name and exit non-zero.

**Logging, masking, email**
- src/server/log.ts:
  - new id-only keys: clientId, membershipId, encounterId, captureId, noteId, scanId, letterId, taskId, subscriptionId, timerId, job, vendor, mode, tier
  - `code` must match /^[a-z][a-z0-9_]{1,40}$/, and `type`, `kind`, `status`, `state`, `from`, `to` must be lower-case identifiers
- src/core/mask.ts `last4()`.
- Email is chosen by modeFor. Live throws NotConfigured until S21a. The fixture prints only the outbox path, plus the link for sign-in mail.

**Repo hygiene**
- .gitignore: `data/` becomes `data/*` with `!data/payers/` and `!data/codes/`.
- src/server/db/schema.test.ts gets an explicit GLOBAL_TABLES allow-list.
- Boundary rules (eslint plus src/boundaries.test.ts):
  - @anthropic-ai/* only in src/lib/ai.ts and src/server/integrations/llm/**
  - no 'use cache' directive and no unstable_cache/cacheLife anywhere under src/app except src/app/(public), or under src/ui or src/server

**Test tooling**
- Add @playwright/test (plus `bunx playwright install chromium`), fast-check, @axe-core/playwright, happy-dom and @testing-library/react.
- vitest include becomes src/**/*.test.{ts,tsx}, scripts/**/*.test.ts and infra/**/*.test.ts; .tsx files run under happy-dom.
- playwright.config.ts: testDir e2e; a webServer running next dev on port 3100 against a ferry_e2e_test database, which resetDb accepts. Later slices add the worker and relay webServers.
- `db:create:e2e` and `test:e2e` scripts; e2e/helpers/outbox.ts reads data/outbox by recipient.
- src/repo-hygiene.test.ts checks that every test file named in docs/sprint-tasks.md matches the vitest include or the Playwright testDir.

#### Acceptance

- [x] guard.test.ts: the direct API is refused for data classes deidentified and real, refused in the prelaunch, staging and prod tiers, and allowed for synthetic in dev; a fetch spy sees zero calls when refused
- [x] mode.test.ts: table over every vendor × tier × override; 'off' is accepted only where the tier allows it
- [x] boot.test.ts table:
  - prod refuses fixture, test or local for every vendor, and off for anything but sms and fax
  - staging refuses fixture and local, and any FERRY_DATA_CLASS but synthetic
  - prelaunch refuses anything not off
  - NODE_ENV=production without FERRY_DEPLOY_TIER refuses
  - each failure names the vendor
- [x] process-errors.test.ts: a spawned child that calls bootProcess and then rejects with a marker exits non-zero, and its stderr lacks the marker but has the error name
- [x] e2e/scrub.spec.ts (next start, FERRY_SCRUB_ERRORS=1): an Error carrying a marker thrown from a route handler and from a server action never appears in the server's stdout or stderr
- [x] log.test.ts: each new key passes; `code: 'F43.25'` and `kind: 'Jane'` are dropped; `code: 'not_owned'` is kept
- [x] email.test.ts: the console output of a non-sign-in mail contains no body text; a sign-in mail prints only the path and the link
- [x] repo-hygiene.test.ts: `git check-ignore -q data/payers/x.json` exits 1 and `git check-ignore -q data/outbox/x.json` exits 0; every test file named in docs/sprint-tasks.md matches the vitest include or the Playwright testDir
- [x] boundaries.test.ts: @anthropic-ai/sdk imported from src/server/services fails; a 'use cache' directive under src/app/app or src/app/api/v1 fails, and one under src/app/(public) passes
- [x] dev-tier.test.ts: assertDevTier refuses in any other tier and against a database not ending _dev or _test
- [x] mask.test.ts: last4('12-3456789') is '6789'; short or empty input is handled
- [x] tooling: a sample .test.tsx runs under happy-dom and appears in the vitest report; e2e/smoke.spec.ts loads /sign-in through `bun run test:e2e` against ferry_e2e_test
- [x] All 154 existing tests, typecheck and lint green

### [x] N3a — Audio core and capture relay skeleton (ws, token, counting, no writes)

Scheduled: Mon Sep 28 · Status: new · Size: M · PRD: P0-5.2, P0-5.6

Depends on: N1

Fixture path: No vendor. Synthetic PCM over a local WebSocket.

Founder blockers: none

Why: Split from N3 so the phone test on Sep 29 doesn't wait on the access-model refactor. The PCM, protocol, gap and relay code here is what N12 and N13 build on. The relay is built on `ws` so that vitest (Node) can run it in-process; Bun.serve doesn't exist under Node.

#### Scope

**Core** (test-first)
- src/core/capture/pcm.ts `downsampleToS16(frame, inRate)`: 16 kHz mono s16le in 100 ms frames of 3,200 bytes.
- src/core/capture/protocol.ts: zod frame header {captureId, seq, msOffset} plus control messages.
- src/core/capture/gaps.ts `gapsFrom(intervals, minGapMs = 2000)`.

**Relay** (src/server/relay/{main, server, token}.ts)
- Built on the `ws` package, added as a direct dependency. `bun run relay` runs it under Bun on RELAY_PORT; tests start it in-process on port 0.
- main.ts calls bootProcess('relay') first.
- Accepts only a 60-second HMAC token (RELAY_SECRET) bound to {captureId, subject}. The subject is devRun:<id> in the spike and the tenant from N12 on.
- Counts audio ms and keeps connected intervals in memory. It never writes audio or text to disk, the database or logs.
- A newer connection for the same captureId closes the older one.

#### Acceptance

- [x] pcm.test.ts: 48 kHz and 44.1 kHz sine inputs give 1,600 samples per 100 ms, clipped to the int16 range
- [x] gaps.test.ts: no gaps; a 1 s blip ignored; two gaps with reasons and durations
- [x] relay.test.ts (in-process ws server, real ws client): missing, expired, forged and wrong-capture tokens are refused
- [x] relay.test.ts: 50 frames of 100 ms count as 5,000 ms
- [x] relay.test.ts: a second connection for the same capture closes the first
- [x] relay.test.ts: fs write spies and log() spies record zero audio bytes and zero writes
- [x] relay-boot.test.ts: spawning the relay with FERRY_DEPLOY_TIER=prod and a fixture vendor exits non-zero, naming the vendor

### [x] S18a — Installable web app shell: manifest, service worker, install prompt, offline page (split from S18, moved up)

Scheduled: Tue Sep 29 · Status: modified · Size: M · PRD: P0-5.1, P0-7.3, P0-9.1

Depends on: N1

Fixture path: No vendor. Playwright plus Chromium's installability check over localhost.

Founder blockers: F11 app icon/logo before the prod tier (placeholder tile until then)

Why: D4 makes the installable web app the launch phone app. The Sep 29 mic test has to run installed on an iPhone, so the shell comes first. It depends only on N1: until N2b, it adds its paths to today's proxy matcher.

#### Scope

**Manifest and service worker**
- src/app/manifest.ts: name from BRAND, start_url /home, display standalone, cream theme, 192, 512 and maskable icons.
- Placeholder icons are plain navy tiles flagged `placeholder: true` in src/core/pwa/icons.ts. FERRY_BRAND §12.5 forbids improvising a logo. bootProcess refuses placeholder icons in the prod tier.
- src/pwa/sw.ts is built to public/sw.js by a new `build:sw` script (bun build); the same script builds public/worklets/* for N3b.
- src/core/pwa/cache-policy.ts: pure `cachePolicy(url)` returns precache | network_only | navigate_with_offline_fallback.

**Pages and components**
- src/app/(public)/offline/page.tsx, whose copy promises nothing will be sent later.
- src/ui/install-prompt.tsx: beforeinstallprompt on Android and desktop Chrome; an Add to Home Screen sheet on iOS; hidden once installed.

**Caching and routing**
- next.config.ts sends Cache-Control: no-store on /app, /c, /i and /api.
- Sign-out posts a message that clears Cache Storage.
- src/proxy.ts matcher excludes /manifest.webmanifest, /sw.js, /worklets/, /icons/ and /offline; N2b folds these into PUBLIC_PATHS.

#### Acceptance

- [x] proxy.test.ts: signed out, /manifest.webmanifest and /sw.js return 200
- [x] cache-policy.test.ts table: /app/**, /c/**, /i/** and /api/** are network_only; only /offline, hashed /_next/static, fonts, icons and /worklets/* are precached
- [x] e2e/pwa.spec.ts: CDP Page.getInstallabilityErrors returns no errors
- [x] e2e/pwa.spec.ts: after signed-in pages are visited, Cache Storage holds no /app, /c, /i or /api entries; signing out empties it
- [x] offline-copy.test.ts: the offline page text contains no promise to send later
- [x] boot.test.ts: the prod tier refuses to boot while any icon is flagged placeholder; the prelaunch tier allows it

### [x] N3b — Phone recorder, dev:phone tunnel and device matrix (Gate A)

Scheduled: Tue Sep 29 · Status: new · Size: M · PRD: P0-5.1, P0-5.2, P0-7.3

Depends on: N3a, S18a

Fixture path: No vendor. Synthetic tone and `say` speech; Playwright fake media device; the relay only counts bytes.

Founder blockers:

- Ryan: 15 minutes on Tue Sep 29 evening with an iPhone on iOS 18.4+, plus an Android phone if available. Synthetic speech only through the tunnel.
- Approve `brew install caddy cloudflared`

Why: Recording in an installed iOS web app is the most likely thing to sink launch. Reports say the mic stops on screen lock, on a call and after reopening a Home Screen app, and Wake Lock needs iOS 18.4+. D4 is due Sep 30. The same session also checks whether an Android file input leaves a copy in the gallery, which decides whether S4b's viewfinder can ever slip.

#### Scope

**Browser**
- src/ui/capture/pcm-worklet.ts, an AudioWorkletProcessor built to public/worklets/pcm.js.
- src/ui/capture/recorder.ts:
  - getUserMedia, an AudioContext running the worklet, and a ws sender
  - holds a Screen Wake Lock
  - listens for visibilitychange, pagehide, AudioContext statechange (including 'interrupted') and track mute/ended
  - stops every track on stop
- MediaRecorder is not used: HealthScribe streaming accepts only pcm, ogg-opus or flac.

**Dev-only pages** (no sign-in; tier dev and a valid per-run key k required, otherwise 404)
- /dev/mic and POST /api/dev/relay-token, which issues tokens bound to {captureId, devRunId}.
- /dev/file-input: a plain `<input type=file accept=image/*>` with no capture attribute. Ryan picks 'Camera' on Android and checks the gallery; the image is discarded in memory.
- The proxy matcher lets /dev/* and /api/dev/* through; the routes themselves enforce tier and k. N2b folds this into a dev-only PUBLIC_PATHS entry.
- With FERRY_SPIKE_K set in the dev tier, the manifest's start_url is /dev/mic?k=<k>, so the installed app opens on the spike.

**Phone testing: `bun run dev:phone`**
- assertDevTier; refuses unless FERRY_DATA_CLASS=synthetic.
- Starts next dev and the relay, puts Caddy in front (/ws/* to the relay, everything else to Next), and exposes it through a cloudflared quick tunnel so the phone gets a trusted certificate.
- Prints a QR code for https://<tunnel>/dev/mic?k=<32 random bytes>.

**Device matrix and corpus**
- docs/plans/capture-device-matrix.md:
  - rows: iPhone Safari tab, iPhone installed, Android Chrome tab, Android installed, macOS Chrome, macOS Safari, Android file input
  - columns: 5-minute continuous, screen lock, incoming call, app switch, wake lock held, mic works after reopen, gap shown, gallery copy left
- scripts/corpus/audio.ts renders corpus/synthetic/audio/tone-10s.wav and a `say` speech file with afconvert.
- The Playwright config gains the relay webServer.

#### Acceptance

- [ ] e2e/mic-spike.spec.ts: Chromium with --use-fake-device-for-media-stream and --use-file-for-fake-audio-capture=corpus/synthetic/audio/tone-10s.wav records for 10 s; the relay reports 10,000 ms ± 300
  - Written; it skips until macOS grants microphone access to the app running Playwright (Chromium asks the OS even for the fake device). It skips only when getUserMedia hangs; a rejection fails the test. The same path with a WebAudio tone in place of the mic passes on every run (10,100 ms). Tick this only after the test passes rather than skips.
- [x] dev-routes.test.ts: signed out with a valid k, /dev/mic returns 200 in the dev tier
- [x] dev-routes.test.ts: without k, or in any other tier, /dev/mic, /dev/file-input and /api/dev/relay-token return 404
- [x] dev-phone.test.ts: dev:phone refuses without FERRY_DATA_CLASS=synthetic and outside the dev tier
  - Review fix: it also refuses while any vendor is live or test, Caddy passes only the spike's paths to Next (sign-in and the app are 404 on the tunnel), and *.trycloudflare.com is an allowed dev origin only while dev:phone runs. N13's Oct 11 device test of the real product path must widen the Caddy path list deliberately.
- [x] manifest.test.ts: start_url is /dev/mic?k=… only with FERRY_SPIKE_K in the dev tier, and /home otherwise
  - Review fix: the shared /manifest.webmanifest loads signed out, so it is always /home and never carries k. /dev/mic links its own manifest at /api/dev/manifest?k=…, which 404s like the other dev routes and starts at /dev/mic?k=….
- [ ] Gate A: Ryan's run fills the device matrix. Pass bar: 5 minutes continuous in at least one iPhone mode, and every lock, call or app switch shows as a visible gap, never silent loss. If installed mode fails, launch records in a Safari tab. The Android file-input row records whether a gallery copy was left. Both results feed D4.

### [x] N2a — Access model: contexts, roles, guards and staff:grant

Scheduled: Tue Sep 29 · Status: new · Size: M · PRD: P0-9.2, P0-11.1, R12

Depends on: N1

Fixture path: vitest against ferry_test; email fixture for magic links.

Founder blockers: none

Why: Today the context is `Ctx {userId, role}` with roles patient|provider|staff (src/server/auth/ctx.ts:5). The role defaults to 'patient' (auth-schema.ts:23; auth/index.ts:21), and nothing reads it. Every later slice types against Ctx, so the exact access model is fixed here, before any new repo exists.

#### Scope

**ACCESS MODEL** (authoritative; N4 enforces the data rules, S2b the key rule, N0 copies it into architecture §6)

1. **Tenant.** The tenant is the clinician. Every row about a client's care has user_id = the clinician's user id. Exceptions: client_memberships has user_id = the client user, and the Better Auth tables are auth-owned.
2. **Contexts** (src/server/auth/ctx.ts, discriminated on `scope`):
   - ClinicianCtx {scope:'clinician', userId}, from `requireClinician()`.
   - SelfCtx {scope:'self', userId}, from `requireClient()`. It reads only that user's own client_memberships rows.
   - ClientCtx {scope:'client', userId = tenant, clientId, actorId}. Only `clientCtxFor(self, membershipId)` (N4) builds one.
   - InviteCtx {scope:'invite', userId = tenant, clientId, actorId, linkId}. Only `inviteCtx(self, resolved)` in src/server/services/invites.ts (N7a) builds one. Only the links repo, clients.client_user_id and client_memberships accept it.
   - SystemCtx {scope:'system', userId = tenant, job}. Only `systemCtx(tenantId, job)` builds one, importable only from src/server/jobs/**, src/server/relay/**, src/app/api/webhooks/** and src/server/services/ops.ts.
   - StaffCtx {scope:'staff', userId}, from `requireStaff()`. No tenant repo accepts it. It reaches only src/server/db/repos/ops.ts (cross-tenant ids, kinds, ages and counts; never sealed columns) and `staffActFor(staff, taskId)`, which writes an audit row and returns a SystemCtx for that task's tenant (both built in S9).
   - Ctx = ClinicianCtx | ClientCtx | SystemCtx. ClinicianOnlyCtx = ClinicianCtx | SystemCtx.
3. **clientCtxFor** succeeds only when all of these hold; otherwise it throws NotOwnedError, which becomes a 404:
   - the membership has user_id = self.userId and status active
   - its clients row has user_id = membership.clinician_user_id, client_user_id = self.userId and archived_at null
4. **tenantWhere(table, ctx)** filters user_id = ctx.userId. For a ClientCtx it also filters:
   - client_id = ctx.clientId on CLIENT_SCOPED tables
   - id = ctx.clientId on CLIENT_SELF tables (clients)
   and throws on any other table.
5. **Clinician-only repos** type ctx as ClinicianOnlyCtx and also refuse a ClientCtx at run time: clinician_profiles, fee_schedule_items, clinician_consents, encounters, captures, capture_intervals, transcripts, notes, letters (bodies, drafts, citations, PDFs), eligibility_checks, external_calls, subscriptions, notifications.
6. **Client reads** go only through strict zod DTOs in src/core/api/trips.ts:
   - their own clients row (first name, contact)
   - plans and their own client consents
   - claims, with no diagnosis by default
   - timeline entries (state, time, copy key; never event payloads)
   - client-audience tasks
   - a list of letters sent as {kind, payerName, sentAt}: never a letter body, PDF, attachment, draft or citation
   No DTO has a note field or any Tax ID.
7. **Client writes** go through services taking ClientCtx:
   - their own client consents (record, withdraw)
   - insurance entry and card scans
   - insurer-mail scans
   - confirmArrived
   Any clinician-only follow-up (eligibility, fileWaiting) is enqueued as a job carrying the tenant id, never run in the client's request.
8. **resolvers.ts** is the only repo module with ctx-less functions, and it returns ids only:
   - invite token hash → {tenant, clientId, linkId}
   - Stripe customer → tenant
   - patient control number → {tenant, claimId}
   - dueTimers(now) → [{tenant, timerId}]
   - expiredTranscripts(now) and expiredScans(now) → [{tenant, id}]
9. **Roles.** users.role is 'pending' | 'clinician' | 'client' | 'staff', default 'pending', `input:false`. It is set only on the server:
   - the /start intent makes a clinician (N5)
   - acceptInvite makes a pending user a client (N7a); it refuses clinician and staff users and never changes their role
   - `bun run staff:grant <email>` makes staff
   One role per user at launch.
10. **Two clinicians.** A client of two member clinicians has two memberships; client views iterate them.
11. **Clinician claim views** use a strict DTO exposing tax_id_last4 only (S9).

**THIS SLICE BUILDS**
- The context types (with InviteCtx typed but not yet constructible); requireClinician, requireClient and requireStaff; an internal `setRoleOnServer(userId, role)`; the staff:grant script.
- Regenerated auth-schema.ts, and `createTestUser(role)` in src/server/db/testing.ts.
- Until N4, every repo types ctx as ClinicianOnlyCtx and no ClientCtx constructor exists.
- eslint no-restricted-imports for systemCtx and inviteCtx, plus a case in src/boundaries.test.ts.

#### Acceptance

Plan: `docs/plans/slice-n2a.md`. The systemCtx/inviteCtx boundary is the ESLint rule `ferry/ctx-constructors` rather than `no-restricted-imports`, which each layer already sets (a second config object would replace it).

- [x] ctx.test.ts: @ts-expect-error proves a ClientCtx, InviteCtx or StaffCtx can't be passed to any claimsRepo method; scope narrowing compiles
- [x] auth.test.ts: a new magic-link user gets role 'pending'; a role in the sign-up body is ignored (existing role-injection test kept); an unknown role is denied
- [x] staff-grant.test.ts: the script sets role staff for an existing user and refuses an unknown email
- [x] boundaries.test.ts: importing systemCtx from src/app/app/**, or inviteCtx outside src/server/services/invites.ts, fails lint
- [x] Existing api, isolation and schema tests migrated to createTestUser('clinician') and green; typecheck and lint green

### [x] N2b — Public routes, /start fork, proxy PUBLIC_PATHS and patient-MVP deletions

Scheduled: Wed Sep 30 · Status: new · Size: M · PRD: P0-1.1, P0-9.2, P0-11.1, R12

Depends on: N2a, S18a, N3b

Fixture path: Email fixture for magic links; vitest against ferry_test.

Founder blockers: none

Why: The proxy (src/proxy.ts:13) sends / to sign-in, so the homepage can't render. The patient pages show the full Tax ID (src/app/claims/[id]/page.tsx:81, edit/page.tsx:41). src/server/storage/local.ts writes plaintext uploads (called at services/claims.ts:177), and data/uploads still holds files.

#### Scope

**Routes**
- Public:
  - / (placeholder showing BRAND.name)
  - /start with a fork: 'I'm a clinician' goes to sign-up (built in N5); 'I'm a client' goes to /for-clients (S11c), and the role stays pending
  - /i/[token] stub, /legal/[doc], /for-clients, /offline
- Signed in: /app/** clinician, /c/** client, /ops/** staff.
- /home redirects by role; pending goes to /start.

**Proxy**
- src/proxy.ts gets explicit PUBLIC_PATHS, mirrored in guards.test.ts: /, /start, /for-clients, /i/*, /legal/*, /offline, /manifest.webmanifest, /sw.js, /worklets/*, /icons/*, /api/webhooks/*, /sign-in, /api/auth/*.
- A DEV_PUBLIC_PATHS entry (/dev/*, /api/dev/*) applies only in the dev tier; the routes still require k.

**Deletions (patient MVP surface)**
- Pages: src/app/page.tsx (dashboard), /plans, /plans/new, /claims/new, /claims/[id], /claims/[id]/edit.
- Their actions in src/app/actions.ts, /api/claims/[id]/superbill and /packet, and components/follow-up-card.tsx.
- src/lib/templates.ts, and src/lib/ai.ts (guard.ts stays).
- createClaimFromUpload; src/server/storage/local.ts, src/server/services/documents.ts, src/server/db/repos/documents.ts and the documents table.
- data/uploads/*, after checking each file's sha256 against corpus/synthetic. Any file that doesn't match is listed for Ryan, not deleted.

**Kept for reuse:** the claims save with CMS-1500 lines, LineItemsEditor, packet.ts (S9), followups.ts (S10), extraction.ts money helpers (S4).

#### Acceptance

Plan: `docs/plans/slice-n2b.md`. The proxy matcher now skips only `_next/` and `favicon.ico`, so `PUBLIC_PATHS` is the one allow-list. Also removed, because their only callers or their data went with the MVP: `services/follow-ups.ts`, `components/superbill-preview.tsx`, `hasSuperbill` in the v1 claim DTO, and packet.ts's patient-voice cover letter. Both files in data/uploads matched corpus/synthetic by sha256 (sb-02.pdf, sb-06.pdf) and went to the macOS Trash; none were left for Ryan.

- [x] proxy.test.ts table: signed out, no PUBLIC_PATHS entry is redirected; /app/claims redirects to /sign-in; /api/v1/claims returns 401; /dev/mic passes the proxy only in the dev tier
- [x] guards.test.ts fails if an /app page lacks requireClinician(), a /c page lacks requireClient(), an /ops page lacks requireStaff(), or a public page is missing from PUBLIC_PATHS
- [x] home-redirect.test.ts: clinician goes to /app, client to /c, staff to /ops, pending to /start
- [x] start-fork.test.ts: a pending user choosing 'I'm a client' lands on /for-clients with the role still pending, and never reaches clinician onboarding
- [x] deletions.test.ts: no file under src/app references billingProviderTaxId; src/server/storage/local.ts and the documents table no longer exist; no src file imports putFile
- [x] typecheck, lint and all remaining tests green

### [x] N4 — Tenancy data: clients, memberships, tenantWhere, resolvers (test-first; enforces the N2a access model)

Scheduled: Wed Sep 30 · Status: new · Size: L · PRD: P0-4.1, P0-9.2, P0-11.1, R12

Depends on: N2a, N2b

Fixture path: ferry_test and demo:seed only; no vendor.

Founder blockers: none

Why: S2 made each patient the owner of their own rows. Every repo filters user_id = ctx.userId, and isolation.test.ts and schema.test.ts enforce that one-owner shape. The clinician-owns, client-reads model has to be in the data before S2b's per-tenant key and before any new table exists.

#### Scope

**Tables**
- clients (cli_):
  - user_id = clinician; first_name, last_name, dob, email, phone (plaintext until S2b the next day)
  - client_user_id (nullable FK users); archived_at
  - on CLIENT_SELF
- client_memberships (mbr_): user_id = the client user; clinician_user_id FK users; client_id; status active|revoked; created_at.
- plans, claims, claim_lines and events gain client_id NOT NULL and go on CLIENT_SCOPED.
- ids.ts adds cli and mbr. Migrations are squashed again; nothing is deployed.

**Scoping**
- src/server/db/repos/scope.ts: `tenantWhere(table, ctx)` with CLIENT_SCOPED and CLIENT_SELF, per access-model rule 4.
- `clientCtxFor(self, membershipId)` checks both sides, per rule 3.
- Every existing repo (claims, plans, events, follow-ups, owned.ts) moves to tenantWhere and the Ctx union. Clinician-only repos get a run-time `assertNotClient(ctx)`.

**Other**
- src/server/db/repos/resolvers.ts starts with patient control number → {tenant, claimId}.
- /api/v1/claims becomes clinician-scoped.
- schema.test.ts rules:
  - CLIENT_SCOPED tables need client_id NOT NULL, except listed nullable exceptions that carry a CHECK (tasks, from S10)
  - CLIENT_SELF tables are exempt from client_id
- `bun run demo:seed` (assertDevTier) builds the isolation world idempotently:
  - clinicians X and Y
  - X's clients A1 and A2; Y's client B1
  - client user U bound to A1 and B1

#### Acceptance

Plan: `docs/plans/slice-n4.md`. The route behind client-ctx.test.ts is `GET /api/v1/memberships/[id]` (the client's own first name, via `ClientSelfSchema` in `src/core/api/trips.ts`); S12 adds the trips routes. Reads (`list`, `get`, `lines`, `forClaim`) take `Ctx`; every write stays `ClinicianOnlyCtx` with `assertNotClient` until a slice adds a client write. `follow_ups` and `providers` are clinician-only (no client_id; both are deleted in S10 and N5). A claim takes its `client_id` from its plan. The patient control number is the claim id until S8 fixes the CLM01 format. resolvers.test.ts exempts `repos/users.ts` (auth-owned, already lint-confined to roles and invites) and checks only modules holding the db handle, so `scope.ts`'s `tenantWhere(table, ctx)` is out of its reach. `bindClientUser` in `db/testing.ts` stands in for acceptInvite (N7a); demo:seed writes its fixed-id rows directly.

- [x] isolation.test.ts v2, written first: X reads only A1/A2 rows in every repo; Y reads nothing of X's; updates and deletes are scoped the same way
- [x] isolation.test.ts: clientCtxFor(U, A1 membership) reads A1's clients row, plans, claims and events and nothing of A2's; clientCtxFor(U, B1 membership) reads only B1's
- [x] client-ctx.test.ts: a forged id, inactive membership, another user's membership, archived client or mismatched client_user_id each throws NotOwnedError, and the route returns 404
- [x] scope.test.ts: tenantWhere with a ClientCtx matches clients by id (CLIENT_SELF), filters CLIENT_SCOPED tables by client_id, and throws on any other table
- [x] schema.test.ts fails if a CLIENT_SCOPED table lacks client_id NOT NULL (outside the listed exceptions), or if any table outside the auth tables, client_memberships and GLOBAL_TABLES lacks user_id NOT NULL
- [x] resolvers.test.ts (static): resolvers.ts is the only module under repos exporting a function whose first parameter isn't a ctx
- [x] api.test.ts: GET /api/v1/claims lists only the caller's tenant and returns 404 for a client session
- [x] demo-seed.test.ts: running demo:seed twice leaves identical row counts; it refuses outside the dev tier

### [ ] S3c — UI foundation: brand tokens and components for clinician desktop and client phone

Scheduled: Thu Oct 1 · Status: modified · Size: L · PRD: P0-1.1, P0-1.3, P0-9.1

Depends on: N2b

Fixture path: Static gallery; no data, no vendor.

Founder blockers:

- F11 tokens.json and logo (text wordmark until then); confirm whether the boat mark in docs/spec.html is approved
- Approve the FERRY_BRAND §13 clinician draft

Why: The homepage, onboarding, note screen and tracker all need the brand system. Today's UI is the unbranded MVP: Geist, the stone palette (a banned warm grey), shadows, divide-y and uppercase headings, with 'Superbill Claims' in src/app/layout.tsx.

#### Scope

**Tokens and fonts**
- Tailwind 4 @theme tokens from FERRY_BRAND.md §3–§5 in globals.css.
- Bricolage Grotesque and Figtree via next/font; Lucide icons.

**Components** (src/components/* moves to src/ui/*)
- Button (primary, secondary, tertiary), Card, Chip (the 7 in §12.2), Input, 3-segment ProgressBar, TimelineRow, Screen.
- BottomNav in clinician and client variants.
- For the clinician desktop and homepage (docs/spec.html): DesktopHeader, SegmentedControl, CodeChip, RecordButton (level meter and timer), EditableSection (tap to edit), PricingCard, Disclosure.

**Branding**
- layout.tsx takes its title from BRAND.name, and the 'Data stays on this machine' footer goes.
- package.json name becomes ferry.
- A text wordmark stands in for the logo until F11.

**Gallery and brand amendment**
- Dev-only gallery at /dev/ui.
- Draft a FERRY_BRAND.md §13 'clinician surfaces' from docs/spec.html (desktop header, note editor, code chip, segment labels that don't say 'Snapped'), marked DRAFT for Ryan.

#### Acceptance

- [ ] tokens.test.ts: every FERRY_BRAND §3–§5 token exists under the same name; no hex colour appears outside the theme file
- [ ] chips.test.tsx (happy-dom): all seven §12.2 chips render with the specified fill and text
- [ ] e2e/gallery.spec.ts: renders at 390 px and 1280 px with document scrollWidth no wider than the viewport, and at 130% text scale; reduced motion disables the wave
- [ ] e2e/gallery.spec.ts (axe): icon-only buttons have aria-label; every control is a real button, a or input element
- [ ] banned-classes.test.ts: no stone-, shadow-, divide-, bg-gradient or uppercase class anywhere in src/
- [ ] banned-classes.test.ts: 'Superbill Claims' appears nowhere in src/
- [ ] banned-classes.test.ts: no gallery screen has two primary buttons

### [ ] S11c — Homepage, pricing, /for-clients and legal pages, deployable in the prelaunch tier

Scheduled: Thu Oct 1 · Status: modified · Size: M · PRD: P0-1.1, P0-1.2, P0-1.3, P0-1.4, R1, R2, R3

Depends on: N2b, S3c

Fixture path: Static page; no vendor.

Founder blockers:

- D1 price by Oct 4 (one constant after that)
- D2 item 10: 'on video' and 'Unlimited' wording
- Contact address for 'Talk to us' and 'Join the beta'
- A domain and any host for the preview (it holds no client data)
- D3 by Oct 1 (the /for-clients message)
- F11 logo

Why: P0-1, and beta recruiting has to start now. It replaces the old 'Snap a superbill' landing page and waitlist. The prelaunch tier lets the page go on any public host before the real stack exists. /for-clients is the only place a non-member's client can reach the 'invite your therapist' link (D3).

#### Scope

**Homepage**
- src/app/(public)/page.tsx and src/ui/home/*.
- Copy lives in src/core/copy/home.ts, taken from docs/spec.html #screen-1:
  - banner
  - header (How it works / Security / Pricing / For groups, Log in, Start free)
  - hero and the three promises
  - how it works: four capture tabs and three steps
  - why clinicians
  - security Q&A
  - pricing: Free trial / Membership / Groups custom
  - questions, closing band, footer
- src/core/copy/home-claims.ts maps every promise sentence either to the test id that proves it, or to 'flagged-for-Ryan'. Flagged today:
  - 'Record in the room or on video' (docs/spec.html:369; telehealth capture is P1)
  - 'Unlimited notes and dictation' (:425; depends on D5 and the S28b limits)
  An AMENDMENTS list holds Ryan-approved wording changes against the spec.
- src/core/billing/pricing.ts: `PRICING {monthlyCents: 5000, trialDays: 7}`, the D1 placeholder that N6 reuses.

**Links**
- Start free goes to /start; Log in to /sign-in; Talk to us to a mailto from config.
- Privacy and Terms go to /legal/[doc], rendered from content/legal/*.md with front matter {version, placeholder: true}.
- The footer links to /for-clients.

**/for-clients** (D3)
- A public page with a share action (Web Share, falling back to a mailto) carrying a fixed 'invite your therapist' message. No sign-up, no form, nothing stored.

**Prelaunch tier** (FERRY_DEPLOY_TIER=prelaunch, which implies FERRY_PRELAUNCH=1)
- Only public routes are served; everything else returns 404; every vendor is off.
- 'Start free' reads 'Join the beta' and opens the mailto.
- No analytics or third-party script on any page.

#### Acceptance

- [ ] home-copy.test.ts: the rendered text equals the #screen-1 text parsed from docs/spec.html (whitespace normalized), apart from the AMENDMENTS list
- [ ] home-claims.test.ts: every promise sentence on the page maps to an existing test id or 'flagged-for-Ryan'; an unmapped sentence fails; the flagged list is printed
- [ ] pricing-grep.test.ts: every price renders from PRICING; no '$9' in src/ or content/; no 'per claim' or 'per-claim' except 'No per-claim fees.'
- [ ] banned-patterns.test.ts: no reviews, testimonials, star ratings or user counts; 'Signed BAA on every plan' is present and 'HIPAA compliant' appears nowhere (Q-L4)
- [ ] e2e/home.spec.ts: at 390 px one column and scrollWidth ≤ 390; survives 130% text; capture tabs are buttons with aria-pressed; the FAQ uses details/summary
- [ ] e2e/home.spec.ts: no request to a third-party origin on /, /for-clients or /legal/terms
- [ ] e2e/home.spec.ts: signed out, /for-clients is reachable from the homepage footer and from /start, and its share action carries no health words (assertNoPhi, once N7a exists)
- [ ] prelaunch.test.ts: `bun run build && FERRY_DEPLOY_TIER=prelaunch bun run start` with every vendor off serves / with 200; /app, /c, /api/v1 and /sign-in return 404; Start free is a mailto
- [ ] `bun run lighthouse:home` (bunx lighthouse, mobile preset) exits non-zero below 90 for performance or accessibility

### [ ] S2b — Envelope encryption: per-tenant keys, per-record ephemeral keys outside Postgres, column classification

Scheduled: Fri Oct 2 · Status: modified · Size: L · PRD: P0-11.2, P0-3.1, P0-5.3, P0-5.5, R9, R13

Depends on: N4, N1

Fixture path: Local KeyProvider and local EphemeralKeyStore; the KMS and DynamoDB clients are mocked. No AWS.

Founder blockers: F5 for live only: KMS key and DynamoDB table in us-east-1 under the AWS BAA

Why: P0-11 requires encryption before any real data, and the Tax ID invariant needs it. The 24-hour rule (docs/prd.md:90, commit c795a80) needs keys that RDS backups don't hold. Keys are per clinician tenant, so a canceled clinician's filed claims can still be chased and read by clients (edge case 16, R13). Free-text columns (claims.extraction_notes, info_requested, confirmation_number; events.note at schema.ts:92-98, 167) show that sealing column by column misses things, so every column gets classified.

#### Scope

**Key providers** (src/server/crypto)
- `KeyProvider {wrap, unwrap}`, chosen by modeFor('keys'):
  - local: KEK from env, created by `bun run keys:dev`; refuses outside the dev tier
  - aws-kms: contract test against a mocked KMS client
- tenant_keys: one data key per clinician tenant. A ClientCtx decrypts with its tenant's key inside repos.
- `seal`/`open`, format v1.<keyId>.<iv>.<ct>.<tag>, AES-256-GCM. `blindIndex`: HMAC under a separate key.

**Ephemeral keys**
- `EphemeralKeyStore {create(recordId, expiresAt), get(recordId), destroy(recordId)}`, chosen by modeFor('ephemeralKeys'):
  - local: a key directory outside the database (data/keys, gitignored), dev tier only
  - dynamodb: a table with point-in-time recovery and backups off, plus TTL; mocked here, provisioned in S21a/S21b
- `sealEphemeral` and `openEphemeral`; openEphemeral refuses after expires_at, even before destroy runs.

**Sealed columns and classification**
- Sealed:
  - clients: names, DOB, email, phone, plus a contact blind index
  - plans: member_id plus a member blind index; subscriber and patient fields
  - claims: diagnosis codes, the Tax ID snapshot (with tax_id_last4), denial_reason
  - claim_lines: codes
- One repo-level column codec, so later slices declare sealed columns in one place.
- src/server/db/columns.ts: every text, jsonb or bytea column in a non-auth table is listed as SEALED, EPHEMERAL or PLAINTEXT_OK (with a reason).
- Auth tables are excluded by name, with the decision recorded:
  - users.name stays null for client users
  - users.email is plaintext because Better Auth looks it up; RDS encryption at rest protects it

**Test helpers**
- `rawDump()`: pg_dump of ferry_test (public and pgboss schemas, auth tables excluded) as text.
- `decryptedDump(tenantId)`: every SEALED value opened with the tenant key, and every EPHEMERAL value opened when its key still exists.
- These are the helpers later slices extend.

**Retention**
- Pure src/core/tenancy/retention.ts `canDestroyTenantKey({openClaims, canceledAt, now})`.
- File Storage moves to S14; scans and audio are never stored.

#### Acceptance

- [ ] seal.test.ts: flipping one ciphertext byte fails to open; two seals of the same plaintext differ
- [ ] columns.test.ts: fails if any text, jsonb or bytea column in a non-auth table is missing from SEALED, EPHEMERAL or PLAINTEXT_OK; today's claims.extraction_notes, info_requested and confirmation_number and events.note are classified (dropped in S10)
- [ ] raw-dump.test.ts: rawDump() of a seeded ferry_test contains none of the seeded client names, emails, member IDs, diagnosis codes or Tax IDs
- [ ] blind-index.test.ts: finds a plan by member ID and a client by email without decrypting any row
- [ ] tenant-key.test.ts: ClientCtx(U→X) reads A1's plan in plaintext; Y's tenant key cannot open it
- [ ] shred.test.ts (on a test-only table created in the test): copy a sealEphemeral row, destroy its key, re-insert the copy as a restored backup; it cannot be decrypted
- [ ] shred.test.ts: openEphemeral returns nothing after expires_at, before destroy
- [ ] raw-dump.test.ts: the dump contains no ephemeral key material
- [ ] kms.contract.test.ts and dynamodb.contract.test.ts pass against mocked clients
- [ ] boot.test.ts: the local providers are refused outside the dev tier
- [ ] retention.test.ts table: an open claim gives no; all closed and canceled 29 days ago gives no; 30 days gives yes

### [ ] S3b — Consent records (clinician and client), versioned legal texts, re-consent and live-use gates

Scheduled: Fri Oct 2 · Status: modified · Size: M · PRD: P0-2.2, P0-3.3, P0-4.2, P0-11.1, R4

Depends on: N4, S2b, S3c, S11c

Fixture path: Placeholder legal markdown; local DB.

Founder blockers:

- F4 attorney wording:
  - terms, privacy, BAA (Ferry as the clinician's business associate)
  - Q-L1 filing authorization
  - Q-L2 recording consent in all-party-consent states, family sessions and guardians of minors
  - client filing consent
  Live gates stay shut until then.

Why: Each item here needs its own consent or authorization record:
- P0-2: terms and BAA stored with a hash at sign-up
- P0-3: the clinician's filing authorization
- P0-4: two separate client consents that can be withdrawn
The attorney's answers (Q-L1, Q-L2, Q-L3) are the likeliest non-code blockers, so assertLiveLegal turns them into a content swap. Beta clinicians will first accept placeholder texts, so a stale consent must block the gates until re-consent.

#### Scope

**Tables** (split, so the access model holds)
- clinician_consents (ccn_): user_id = tenant; doc_type terms | privacy | baa | npi_filing_authorization; version; content_hash; typed_name (sealed); ip; user_agent; created_at; withdrawn_at. Clinician-only.
- client_consents (kcn_): user_id = tenant; client_id NOT NULL; actor_user_id; doc_type client_filing | client_recording; signer_relationship self | parent_guardian | legal_representative; version; content_hash; typed_name (sealed); ip; user_agent; created_at; withdrawn_at. On CLIENT_SCOPED.
- A signer_relationship of 'self' is refused when the client's DOB is under 18.

**Legal texts**
- content/legal/{terms, privacy, baa, npi-filing-authorization, client-filing, client-recording}.md, each with front matter {version, placeholder: true}.

**Core** (src/core/legal.ts)
- `docHash()`.
- `currentConsent(records, docType, liveHash)` → current | stale | none.

**Services**
- `recordConsent` and `withdrawConsent`. A ClientCtx may record only client types; a ClinicianCtx only clinician types.
- Withdrawing a client consent emits pg_notify('consent_withdrawn', {tenant, clientId, docType}) with ids only, plus an in-process hook list. N10 and N12 register the handlers.
- Guards:
  - `requireFilingConsent(ctx, clientId)` needs the client's current client_filing and the clinician's current npi_filing_authorization
  - `requireRecordingConsent(ctx, clientId)`
  - both throw ConsentStale when the text has changed since signing
  - `assertLiveLegal(docTypes)` throws while any listed text is a placeholder
- Re-consent interstitials at /app/reconsent and /c/reconsent: shown when a gate throws ConsentStale, or at sign-in when any consent is stale.

**Consent screens**
- Filing consent lists each field sent to the insurer, with a one-line reason.
- Recording consent says: audio is never stored, transcripts are erased within 24 hours, nothing is used for model training.

#### Acceptance

- [ ] consent.test.ts: a record stores version and sha256; after the text changes, currentConsent returns stale and the row is unchanged
- [ ] consents.test.ts: recording and filing consents are separate rows; withdrawing one sets withdrawn_at and leaves the other current
- [ ] consents.test.ts: a ClientCtx recording a clinician doc type throws, and vice versa
- [ ] consents.test.ts: requireFilingConsent throws without either half; requireRecordingConsent throws immediately after withdrawal
- [ ] consents.test.ts: after a legal text's hash changes, requireFilingConsent and requireRecordingConsent throw ConsentStale until re-consent, then pass
- [ ] minor.test.ts: a 'self' signer for a client under 18 is refused; 'parent_guardian' is accepted
- [ ] withdraw-notify.test.ts: withdrawal emits one consent_withdrawn notification carrying ids only
- [ ] e2e/reconsent.spec.ts: after a text version bump, the next gated action shows the re-consent screen; accepting it resumes the action
- [ ] legal-gate.test.ts: assertLiveLegal(['npi_filing_authorization']) throws while placeholder is true and passes once false
- [ ] filing-consent.test.tsx: the screen lists name, DOB, member ID, diagnosis, procedure codes, dates and charges, each with a reason
- [ ] columns.test.ts and raw-dump.test.ts extended: typed_name is sealed; log.test.ts: ip and user agent never reach logs

### [ ] N5 — Clinician Start free, onboarding, profile, fee schedule, filing authorization and sign-up policy (replaces S11 and S24)

Scheduled: Sat Oct 3 · Status: new · Size: L · PRD: P0-2.1, P0-2.2, P0-3.1, P0-3.2, P0-3.3, R1, R10

Depends on: N4, S2b, S3b, S3c

Fixture path: Magic link through the email fixture; placeholder legal texts; CDP virtual authenticator; no NPPES call until S6.

Founder blockers:

- F4 Q-L1 authorization wording (live filing refused while it is a placeholder)
- S3 passkey Touch ID manual check (2 minutes)
- F15 beta allow-list emails before the prod tier
- Product question 8: who performs the manual identity check

Why: This is the first step of the value path (P0-2, P0-3). The clinician is now the paying customer, and every claim takes its billing party, charges and legal authority from this profile. Ferry files under the NPI the clinician enters, so the impersonation guard and one-trial-per-NPI live here from day one. Better Auth passkeys register only inside an existing session, so the passkey is offered right after the first magic-link sign-in.

#### Scope

**Sign-up**
- /start 'I'm a clinician': email-only sign-up by magic link, no card.
- A signed httpOnly intent cookie drives `completeClinicianSignup`, which sets role clinician on the server and records the terms and BAA consents (S3b).
- Right after the first sign-in, the existing S3 passkey plugin offers Face ID / Touch ID registration.
- `signupPolicy(tier)`:
  - dev and staging: open
  - prod: only emails on BETA_ALLOWLIST (F15) until FERRY_OPEN_SIGNUP=1
  - prelaunch: /start is a mailto

**Onboarding** (/app/welcome)
1. Agree to terms and BAA. In the prod tier, completing onboarding calls assertLiveLegal(['terms','baa']).
2. NPI: check digit via src/core/npi.ts; NPI-1 vs NPI-2; entered by hand until S6 prefills it.
3. Tax ID: EIN or SSN; sealed, with a blind index and last four.
4. Practice address, license state and number, credential, taxonomy from a behavioral set.
5. A fee per CPT code, using COMMON_BEHAVIORAL_CODES with our own short descriptions, never AMA descriptor text.
6. Default note format.
7. Filing authorization: a typed signature on npi_filing_authorization.

**Tables**
- clinician_profiles (prf_):
  - user_id UNIQUE; legal_name; credential; npi UNIQUE across tenants (one trial per NPI); npi_type; taxonomy_code
  - group_name; group_npi; tax_id (sealed), tax_id_bidx, tax_id_last4; practice_address (sealed)
  - license_state; license_number; default_note_format; default_modality
  - nppes_checked_at; nppes_name_match; identity_verified_at; onboarded_at
- fee_schedule_items (fee_): unique (user_id, cpt_code); charge_cents > 0.

**Core**
- src/core/clinician.ts:
  - `billingParty(profile)`: solo NPI-1 bills and renders; a group bills under NPI-2 plus EIN, with the NPI-1 as rendering provider
  - `liveFilingAllowed(profile, legal)`: true only with nppes_name_match, identity_verified_at set, and a non-placeholder authorization text
- src/core/fee-schedule.ts `chargeFor`.

**Services and routes**
- src/server/services/clinician.ts: `saveProfile`, `setFees`, `authorizeFiling` (typed name, time, IP, user agent, doc hash), `profileForClaims(ClinicianOnlyCtx)`.
- /app/account/profile and /app/account/fees.

**Deletions**
- The per-patient providers table, src/server/db/repos/providers.ts, and claims.billing_provider_id and rendering_provider_id. Claims keep their as-filed snapshot columns.

#### Acceptance

- [ ] e2e/onboarding.spec.ts: Start free asks for an email and nothing else; no card field exists; onboarding completes at 390 px and 1280 px
- [ ] e2e/passkey.spec.ts (CDP WebAuthn virtual authenticator): after the first magic-link sign-in a passkey registers; after sign-out, sign-in with the passkey succeeds
- [ ] clinician.test.ts: the role becomes clinician only from the signed intent; a role in the body, a tampered cookie, or an existing client visiting /start leaves the role unchanged
- [ ] clinician.test.ts: terms and BAA are stored with version and hash at sign-up
- [ ] clinician.test.ts: in the prod tier, onboarding refuses while terms or BAA are placeholders
- [ ] signup-policy.test.ts: in the prod tier an email not on BETA_ALLOWLIST is refused with plain copy until FERRY_OPEN_SIGNUP=1
- [ ] clinician.test.ts: a second profile with an NPI already on another tenant is refused with plain copy; a bad NPI check digit is rejected before any lookup
- [ ] raw-dump.test.ts extended: no Tax ID in the dump; log.test.ts: logging a whole profile emits no Tax ID
- [ ] e2e/onboarding.spec.ts: profile pages show only the last four of the Tax ID
- [ ] billing-party.test.ts: table covers solo NPI-1, and group NPI-2 + EIN with NPI-1 rendering
- [ ] fee-schedule.test.ts: chargeFor returns cents or {missing: cpt}; a fee edit affects only claims built afterwards
- [ ] live-filing.test.ts: table over nppes_name_match × identity_verified_at × placeholder authorization; true only when all pass
- [ ] ctx.test.ts extended: the profile, fee and clinician_consents repos reject a ClientCtx at compile time (@ts-expect-error) and at run time
- [ ] schema.test.ts: the providers table and its FK columns are gone

### [ ] S10 — Claim state machine, event log, id-only job queue, timers table, shared clock and e2e harness

Scheduled: Sat Oct 3 · Status: modified · Size: L · PRD: P0-8.4, P0-9.3, P0-4.2, P0-5.4

Depends on: N4, S2b

Fixture path: pg-boss on local Postgres; DB-backed dev clock; demo:seed claims.

Founder blockers: none

Why: P0-8 says the 16-state loop runs unchanged. The same queue and timers carry trial reminders (N6), 24-hour erasure (N8) and abandoned-capture cleanup (N12). pg-boss compares startAfter with Postgres now(), so a JS fake clock can't drive delayed jobs. And Gates C and D need one clock shared by Next, the worker, the relay and CLI scripts.

#### Scope

**Engine** (as in docs/sprint-tasks.md S10)
- src/core/claim/{states, events, effects, transition, timers, experience}.ts.
- services/claim-engine.ts `applyEvent`.
- pg-boss added; src/server/jobs/{queue, tick}.ts; jobs/handlers/*; worker.ts (`bun run worker`, which calls bootProcess('worker') first).

**Pivot changes**
- No chargeFee.
- requestRecords becomes `openTask({audience, kind, requestRef?})`.
- tasks (tsk_): user_id; client_id nullable with CHECK (audience <> 'client' OR client_id IS NOT NULL); claim_id; audience client|clinician|staff; kind; request_ref; status; opened_at; first_viewed_at; done_at. On CLIENT_SCOPED as a listed nullable exception; a ClientCtx sees only its client's client-audience tasks.
- claim_events (cev_): client_id NOT NULL, on CLIENT_SCOPED; actor clinician|client|system|staff.
- notifications (ntf_): clinician/system only; unique (claim_event_id, recipient_user_id).
- Submit fires on note_approved (N10).
- filing_consent_withdrawn is legal only in draft and ready (→ canceled); in submitted and later states it is recorded, changes nothing, and no void is sent.
- The notify effect names its recipients. chipFor counts only client-audience tasks in the client view.

**Clock and timers**
- src/server/clock.ts: `clock.now()` = system time plus the offset in a dev_clock row, read only in the dev tier. Server code never calls Date.now() directly (lint rule).
- `bun run clock:advance <duration>` (assertDevTier).
- timers (tmr_): user_id; subject; kind; due_at; fired_at; UNIQUE(subject, kind).
  - `scheduleTimer(ctx, {subject, kind, at})` upserts; `cancelTimer(ctx, subject, kind)` deletes.
  - A tick job (pg-boss schedule, every minute) reads resolvers.dueTimers(clock.now()) and enqueues immediate work {tenantId, timerId}.
  - pg-boss startAfter is never used for timers.
- Rules from src/lib/followups.ts move into src/core/claim/timers.ts.

**Job hygiene**
- queue.enqueue(name, payload) validates payload with a strict zod schema of prefixed ids, enums and numbers only.
- A handler wrapper rethrows failures as an Error whose message is the error name, so pgboss.job and pgboss.archive hold no text.
- The worker builds a SystemCtx from the job's tenant id.

**Cleanup and API**
- Delete followups.ts, followups-adapter.ts and the follow_ups table.
- Drop the events table and claims.extraction_notes, info_requested and confirmation_number.
- Widen ClaimSummarySchema.status (src/core/api/claims.ts) to the 16 states; claims.status becomes state.

**E2E harness**
- The Playwright config adds `bun run worker` as a webServer.
- e2e/harness.spec.ts.
- A dev-only `bun run dev:timer` schedules a harness_ping timer.

#### Acceptance

- [ ] transition.test.ts: every §4 transition tested; a generated state × event matrix returns IllegalTransition for every pair not in the table
- [ ] consent-withdraw.test.ts table: filing_consent_withdrawn cancels draft and ready claims with one notify each; submitted, accepted, in_adjudication and later states are unchanged, and no clearinghouse call is made (spy)
- [ ] claim-engine.test.ts: applyEvent writes claim_events, claims.state and effects in one transaction; a forced failure after the event insert leaves no trace
- [ ] notify.property.test.ts (fast-check over random legal sequences): exactly one notify effect per applied transition; each recipient at most once
- [ ] effects.test.ts: the Effect type has no chargeFee member
- [ ] timers.test.ts: advancing the injected clock 24h makes tick() enqueue exactly one job; scheduleTimer with the same (subject, kind) replaces the earlier timer; entering a new state cancels timers that no longer apply; pg-boss startAfter is never called (spy)
- [ ] timers.test.ts: submitted, accepted and in_adjudication timers come from PayerRules defaults
- [ ] worker.test.ts: a due timer runs under a SystemCtx for its tenant; a job for tenant X cannot read tenant Y's rows
- [ ] queue.test.ts: enqueue rejects a payload with free text; a handler throwing an Error carrying a marker leaves no marker in pgboss.job or pgboss.archive (rawDump)
- [ ] e2e/harness.spec.ts: `clock:advance` in a separate process makes the running worker fire a harness_ping timer
- [ ] chip.test.ts: a clinician-audience task leaves the client chip unchanged; a client-audience task makes it 'One quick thing'
- [ ] schema.test.ts and columns.test.ts: follow_ups, events and the three claims free-text columns no longer exist; src/lib/followups*.ts are gone

### [ ] N6 — Membership billing: 7-day no-card trial, day-5 and day-7 reminders, read-only, cancel (replaces S11b and S20)

Scheduled: Sun Oct 4 · Status: new · Size: L · PRD: P0-2.3, P0-2.4, P0-11.1, R1, R13

Depends on: N5, S10

Fixture path: fixture_billing table on the shared dev clock; billing:simulate drives trialing → paused → active → canceled through the webhook path; emails go to data/outbox.

Founder blockers:

- F7 Stripe test keys by Oct 4 (test mode and test clocks)
- F1 LLC/EIN for live charges
- D1 price

Why: P0-2 and R13. Capture, approve, file and letters all check entitlements, so this lands before any of them. A lapsed clinician must still be able to answer insurer letters on claims already filed, or chasing them to closure (edge case 16) fails. The fixture must be drivable from a separate CLI process.

#### Scope

**Core** (src/core/billing/entitlements.ts, test-first)
- `entitlementsFor(facts, now)` returns:
  - mode: trial | member | read_only
  - canCapture, canApproveNotes, canFileNew
  - letters: 'all' | 'filed_before_lapse'
  - chaseFiled: true
  - exportUntil
- `canWorkOnClaimLetters(ent, claim)`: true for 'all', or when claim.submitted_at is before the lapse.
- `trialReminderTimes(trialStart)`.

**Integration** (src/server/integrations/billing, chosen by modeFor('billing'))
- `Billing {ensureCustomer, startTrial, paymentPageUrl, cancelAtPeriodEnd, resume, parseWebhook}`.
- fixture:
  - state in a fixture_billing table, which is refused unless the billing mode is fixture
  - `bun run billing:simulate <event> <email>` (assertDevTier) writes a synthetic event and posts it, signed with a fixture secret, through the same /api/webhooks/stripe → parseWebhook path
- test/live: the Stripe SDK, with trial_period_days=7 and trial_settings.end_behavior.missing_payment_method=pause, plus the Customer Portal for card and cancel.

**Tables**
- subscriptions (sub_): user_id UNIQUE; stripe_customer_id UNIQUE; stripe_subscription_id; status; trial_ends_at; current_period_end; cancel_at_period_end; has_payment_method; ended_at.
- billing_events (bev_): stripe_event_id UNIQUE; type; received_at; applied_at. Ids and type only; on GLOBAL_TABLES.

**Services and routes**
- `startMembershipTrial` runs when N5 onboarding completes.
- `requireEntitlement(ctx, capability)`.
- POST /api/webhooks/stripe: public, raw body, signature checked, tenant found through resolvers.ts.
- /app/account/billing: add card, cancel (with 'active until <date>'), resume.

**Reminders**
- Day-5 and day-7 emails are S10 timers keyed (tenant, kind). Stripe's trial_will_end fires about day 4, so it isn't used.

#### Acceptance

- [ ] entitlements.test.ts table: trialing; active; paused with no card; past_due; cancel_at_period_end before and after period end; canceled +29 and +31 days; read_only gives letters 'filed_before_lapse'
- [ ] billing.test.ts: finishing onboarding creates exactly one customer and one trialing subscription with no card
- [ ] billing.test.ts: billing:simulate paused, then active, drives entitlements through the webhook handler (the fixture path is the webhook path)
- [ ] reminders.test.ts: exactly one day-5 and one day-7 email even when jobs retry; each has an add-card link and no client data
- [ ] billing.test.ts (clock past day 7, no card): mode is read_only; capture, approve and new filing are refused with plain copy; table row counts before and after are equal
- [ ] billing.test.ts: the fixture add-card action restores full access
- [ ] e2e/billing.spec.ts: /app/account/billing → Cancel → banner 'active until <period end>' → clock:advance past period end → read-only banner; exportUntil = end + 30 days
- [ ] engine test with a lapsed tenant: already-filed claims keep their timers
- [ ] webhook.test.ts: bad signature gets 400; a duplicate event id is a no-op; an unknown customer gets 200 and is logged by id only
- [ ] stripe-metadata.test.ts: only an opaque ref is allowed in metadata and descriptions

### [ ] S6b — Payer directory, claim, member-form and letter routes, per-NPI enrollment tracking

Scheduled: Sun Oct 4 · Status: modified · Size: M · PRD: P0-8.1, P0-8.4, P0-10.2

Depends on: N4, N1

Fixture path: JSON in the repo; enrollment status set by script. No vendor.

Founder blockers:

- F2: verify payer IDs against Stedi's list (flagged unverified until then)
- F13 beta clinician NPIs and their clients' top payers by Oct 9, so those payers are verified and enrollments submitted (needs F1 and Stedi production)

Why: Insurance entry (N7b), the 837P (S8), timers (S10), the member-form fallback (S9) and letters (S14) all read the directory. Stedi enrollment is per clinician NPI per payer and can take up to 30 days, so the product must know which enrollments are pending and route around them.

#### Scope

**Directory**
- data/payers/*.json for the top 15 payers, tracked in git thanks to N1's .gitignore fix. Each payer has:
  - Stedi payer ID and claims address
  - member-claim mailing address and fax, if any
  - appeals and records fax and mail addresses
  - timely-filing days
  - transactionSupport for 837P, 270 and 276, each with an enrollmentRequired flag
  - paper-check flag and optional DOI contact
  - a verified flag on every field
- Versioned zod loader: `bun run payers:load`. payers and payer_rules go on GLOBAL_TABLES.
- `getPayer`, `findPayerByName`, `getPayerRules`. PayerRules includes the telehealth POS/modifier preference (95 vs GT; from S25).

**Enrollments**
- payer_enrollments: tenant-scoped; clinician NPI × payer × transaction; status not_needed|needed|submitted|active|rejected.
- `bun run enrollment:set` staff script (audited through staffActFor once S9 lands).
- `enrollmentStatus(ctx, payerId, transaction)`.

#### Acceptance

- [ ] payers.test.ts: 15 payers load; each has a claims route and a member-claim route; unverified fields are flagged, never blank
- [ ] payers.test.ts: a changed file creates a new payer_rules version and never mutates an old one; the loader rejects a file that fails the schema
- [ ] find-payer.test.ts: 'UHC', 'United Healthcare', 'UnitedHealthcare Oxford' and the BCBS variants resolve
- [ ] enrollment.test.ts: enrollmentStatus is 'needed' for an enrollmentRequired payer with no row and 'active' after enrollment:set; another tenant's rows are invisible
- [ ] schema.test.ts passes with payers and payer_rules on GLOBAL_TABLES

### [ ] N7a — Clients, invite links, contact-bound acceptInvite and no-PHI send wrapper (salvages S11's token and assertNoPhi)

Scheduled: Mon Oct 5 · Status: new · Size: M · PRD: P0-4.1, P0-9.2, R4, R12

Depends on: N4, S2b, S3b, S3c, N5, S10

Fixture path: Email and SMS fixtures write to data/outbox; in dev the clinician copies the invite link.

Founder blockers:

- D2 item 6 (email required until SMS)
- Approve the invite wording (question 5)
- F3 Twilio BAA and A2P for SMS invites (email-only until then)

Why: P0-4.1 and story 9: a client must exist and accept before anything else. Invites are the only messages Ferry sends a client before they have an account, which makes them the likeliest place for health details to leak. A bearer-only link would let a typo'd email or a forwarded message bind a stranger to the client's record.

#### Scope

**Clinician side**
- /app/clients, /app/clients/new (name, email; phone optional), /app/clients/[id] with chips: invited, joined, can file, can record.
- Email is required until SMS verification exists (D2 item 6). The contact may be a parent or guardian for a minor.
- A duplicate contact is caught through the blind index.

**Invite links** (links, lnk_)
- purpose 'client_invite'; token_hash UNIQUE; expires_at at 14 days; used_at; revoked_at.
- 32 random bytes, stored hashed. Resending revokes the old token.
- resolvers.ts gains invite token hash → ids.

**Accepting**
- /i/[token] (public):
  - signed out, it shows only 'You have an invitation waiting on Ferry' and sign-in, with no names
  - after sign-in with the matching email, it shows the clinician's display name and the client's first name
- `acceptInvite(self, token)` runs in src/server/services/invites.ts through InviteCtx, in one transaction: mark the link used, set clients.client_user_id, insert client_memberships, and set role client for a pending user. It refuses when:
  - the session's verified email blind index doesn't match the clients contact blind index
  - the user is a clinician or staff (role unchanged)
  - the clients row is already bound to another user
- A contact mismatch shows the same dead end as a bad token and opens one clinician task 'invite_contact_mismatch'. The link stays valid for the right person.

**Messaging**
- src/core/messaging/no-phi.ts `assertNoPhi(body, facts)` rejects names, payer, codes, dates of service, amounts, and care-revealing words (therapy, therapist, session, diagnosis, psychiatr, counsel, mental).
- One send wrapper for email and SMS runs assertNoPhi. Every email template in src/server/messages/** registers through it (enumerated by a test).
- An SmsSender interface with a fixture (data/outbox/sms; refused outside dev). Live comes in S18.
- Without SMS, the invite link is also shown for the clinician to copy.

#### Acceptance

- [ ] clients.test.ts: a duplicate contact in one clinician's roster is caught through the blind index; the same contact under another clinician is allowed
- [ ] invite.test.ts: the token is hashed at rest, single use, expires at 14 days, and is revocable; a resend kills the old token; each use is audited
- [ ] accept.test.ts: acceptInvite writes through InviteCtx, and InviteCtx is refused by every other repo
- [ ] accept.test.ts: a signed-in user whose verified email doesn't match is refused; one clinician task opens; the link then still works for the matching email
- [ ] accept.test.ts: clinician-role and staff-role sessions are refused with their role unchanged; a clients row already bound to another user refuses the token; a forced failure leaves no membership
- [ ] invite-page.test.ts: used, expired, revoked and unknown tokens, and a signed-out valid token, all render with no clinician or client names
- [ ] no-phi.test.ts: every registered email and SMS template passes; a body containing 'session' or the client's name fails; an unregistered template can't be sent
- [ ] isolation.test.ts extended: the v2 cases pass with invite-created clients and memberships

### [ ] N7b — Client welcome: consents, insurance with 837P-required fields, settings and no-membership share page

Scheduled: Mon Oct 5 · Status: new · Size: M · PRD: P0-4.2, P0-8.1, R4, R12

Depends on: N7a, S6b, S3b

Fixture path: Email fixture; typed insurance; demo:seed plans.

Founder blockers:

- F4 consent wording and Q-L2 (including guardians of minors)
- D3 (the share-page message)

Why: P0-4.2 and story 9: consent and insurance in under 2 minutes. The 837P subscriber and patient loops need an address and sex, plus subscriber name and DOB for dependents. Cards don't show these, so nobody collects them unless this step asks.

#### Scope

**/c/welcome**, in order: filing consent → insurance → recording consent → 'Nothing else to do.'
- Insurance is skipped when the client already has a current plan (for example the clinician scanned the card).
- Consents record signer_relationship; a guardian signs for a client under 18.

**Insurance form** (typed; S5 adds scanning)
- Insurer via findPayerByName, member ID, group, plan type, relationship to subscriber.
- The patient's address (sealed) and sex as recorded with the insurer (F/M/U, the 837P DMG values).
- When the relationship isn't self: the subscriber's name, DOB, sex and address (sealed).
- HMO, Medicaid and Original Medicare are gated out, with plain copy for both people.
- The clinician can also enter insurance for a client.
- A new plan supersedes the old one; claims keep their snapshot.

**Other client pages**
- /c/settings: withdraw either consent.
- A /c user with no active membership sees only the /for-clients share action.

#### Acceptance

- [ ] consents.test.ts extended: the two client consents are separate rows with time, typed name, signer relationship, IP, user agent and hash; withdrawing one flips its chip
- [ ] welcome.test.ts: /c/welcome skips the insurance step when a current plan exists
- [ ] insurance.test.ts: gated plan types are refused with copy for both audiences; a new plan supersedes the old, and claims keep a snapshot
- [ ] insurance.test.ts: a non-self relationship requires the subscriber's name, DOB, sex and address; the patient's address and sex are required; all sealed (raw-dump extended)
- [ ] no-membership.test.ts: a /c user with no active membership sees only the share action
- [ ] e2e/invite.spec.ts at 390 px: open the invite from data/outbox → sign in → filing consent → insurance → recording consent → done, within a budget of 25 taps and field inputs, with no member ID typed when a plan already exists

### [ ] S4 — LLM provider (Bedrock / synthetic-only direct / fixture), schema-locked output, hash-only call log, Tax ID guard, scorer (superbill extraction to P1)

Scheduled: Tue Oct 6 · Status: modified · Size: L · PRD: P0-6.1, P0-7.1, P0-10.1, P0-11.4, P0-11.5

Depends on: N1, S2b, N5

Fixture path: Fixture provider by default; Bedrock tested with a mocked SDK client.

Founder blockers:

- F6 ANTHROPIC_API_KEY for synthetic-only real-model runs (add only after this slice)
- F5 Bedrock access in us-east-1 for real data

Why: Notes, codes, card and insurer-mail scans, and letters all need one guarded model client. Claude Sonnet 5 on Bedrock has no structured outputs, so every schema-bound call is a forced tool call. A call log that keeps request and response bodies would keep transcripts and photos past their 24-hour erase, so it keeps fingerprints only. The Tax ID must never reach a prompt.

#### Scope

**Provider** (src/server/integrations/llm/{index, bedrock, anthropic, fixture, guard}.ts, chosen by modeFor('llm'))
- `LlmProvider {extract<T>({document, mime, schema, purpose}), generate<T>({system, input, schema, purpose})}`.
- bedrock: @anthropic-ai/bedrock-sdk, us-east-1, model us.anthropic.claude-sonnet-5.
- anthropic: calls N1's `assertSyntheticDirectApi` first. Data classes deidentified and real always go to Bedrock.
- fixture:
  - extract matches corpus/synthetic/labels.json by sha256, or by a `fixtureCase` id that callers may pass only in the dev tier
  - an unknown document returns an empty result with every field flagged
  - generate returns canned output per purpose and synthetic session, and records every input for tests
  - a switch forces a schema failure

**Guarded wrapper** `llmFor(ctx)`
- Before any call, it refuses input containing the tenant's Tax ID, full or digits-only. The Tax ID is opened in memory from clinician_profiles and never logged.
- Forced tool call: tool_choice type 'tool', input_schema derived from zod.
- zod validation, one retry, then a typed LlmSchemaError carrying only issue paths, never model output.

**Call log** (external_calls, xcl_)
- vendor, purpose, model_id, prompt_version, input_sha256, input_bytes, output_sha256, token counts, latency, status, idempotency_key.
- For LLM purposes it never stores input, output, image, transcript or note text. Other vendors (S9 onward) may store a sealed payload only when that payload is itself a kept record (837P, 277CA).

**Scorer**
- `bun run corpus:score --kind card|note|eob` prints per-field accuracy and writes corpus/results/<ts>.json.
- It exits non-zero under its gate when run with a real model. A fixture run prints 'fixture: not counted'.

**Cleanup**
- Delete the brace parser in src/lib/extraction.ts; move toCents/fromCents to src/core/money.ts.
- Tighten the N1 boundary: @anthropic-ai/* only under src/server/integrations/llm.

#### Acceptance

- [ ] anthropic.test.ts: throws unless FERRY_DATA_CLASS=synthetic, and always outside the dev tier
- [ ] bedrock.test.ts (mocked client): model us.anthropic.claude-sonnet-5, region us-east-1, tool_choice forces the schema tool; invalid tool output retries once, then raises LlmSchemaError with no model text in its message
- [ ] llm-guard.test.ts: a generate or extract input containing the seeded Tax ID ('12-3456789' or '123456789') is refused before any provider call (spy)
- [ ] fixture.test.ts: extract returns labels by sha256 or fixtureCase; fixtureCase is ignored outside the dev tier; an unknown document returns a flagged empty result; outputs are deterministic
- [ ] external-calls.test.ts: one row per call; decryptedDump(tenant) and rawDump contain no prompt text, no document bytes and no base64 prefix (/9j/ or iVBOR) for any LLM purpose
- [ ] log.test.ts extended: a marker in a prompt or response never reaches log()
- [ ] corpus-score.test.ts: a fixture run prints 'fixture: not counted' and exits 0; with F6 set (describe.skipIf otherwise), a run below the gate exits non-zero
- [ ] boundaries.test.ts: @anthropic-ai/* imported outside integrations/llm fails; grep finds no brace-matching parser
- [ ] money.test.ts covers toCents and fromCents

### [ ] N8 — Encounters, typed capture, and 24-hour erasure with lag alert (test-first)

Scheduled: Tue Oct 6 · Status: new · Size: M · PRD: P0-5.1, P0-5.3, P0-5.4, P0-5.5, P0-4.3, R4, R9

Depends on: S2b, S10, N6, N7b

Fixture path: Local EphemeralKeyStore and pg-boss on the dev clock.

Founder blockers: F5 DynamoDB key table for live only

Why: P0-5's retention rule (docs/prd.md:90-92) and the first capture mode on the value path. Erasure has to exist before any transcript does, and must alarm on its own before S29 exists.

#### Scope

**Tables**
- encounters (enc_):
  - client_id; date_of_service (a date); started_at; ended_at; modality in_person|telehealth; place_of_service; status
  - start and stop times are clinician-stated; for recordings they are prefilled from the capture span
  - the name avoids Better Auth's sessions table; 'session' is UI copy only
- captures (cap_): client_id; encounter_id; mode record|dictate|type; status; audio_ms; ended_at; outputs_purged_at.
- transcripts (trn_): client_id; capture_id; kind recording|dictation|typed; body sealed with sealEphemeral; expires_at = created_at + 24h; erased_at.

**Erasure**, three ways:
- a keyed S10 timer at expires_at
- a sweeper every 15 minutes over resolvers.expiredTranscripts(now) and resolvers.expiredScans(now) (S5 reuses it)
- a repo read guard that refuses expired rows before either runs
Erasing destroys the ephemeral key first, then nulls the ciphertext and sets erased_at.

**Lag alert**
- When any transcript is more than 15 minutes past expires_at and not erased, the sweeper logs `alert.erasure_lag` (counts only) and opens one staff task (audience staff, no client).

**Pages**
- /app/sessions/new: pick client, modality, date and times.
- /app/sessions/[id]/type: typed rough notes with autosave.
- Record and Dictate are shown but disabled until N13. Record is disabled with a one-line reason when there is no recording consent.

**Guards and logging**
- Starting a capture requires requireEntitlement(canCapture); record mode also requires requireRecordingConsent.
- The transcript repo never passes text to log().

#### Acceptance

- [ ] erasure.test.ts (dev clock): a read at 23:59 returns the text; at 24:00 it returns nothing with the job and sweeper stopped
- [ ] erasure.test.ts: the timer erases at +24h; the sweeper erases a row whose timer was dropped (advance 24h15m)
- [ ] erasure.test.ts: at +24h, rawDump (including pgboss) and decryptedDump(tenant) contain no marker from the typed text
- [ ] shred.test.ts extended: a transcript row copied before erasure and re-inserted after cannot be decrypted
- [ ] erasure-alert.test.ts: a transcript left 16 minutes past expiry (sweeper disabled once) produces one alert.erasure_lag log line and one staff task; a second run does not duplicate the task
- [ ] log.test.ts extended: a marker in typed text never reaches log(), error output or external_calls
- [ ] captures.test.ts: record mode is refused without current recording consent while type still starts; a read-only tenant cannot start any capture
- [ ] ctx.test.ts extended: the encounters, captures and transcripts repos reject a ClientCtx (type and run time)

### [ ] N9a — Note model, psychotherapy code rules, duration and ICD-10 tables (pure core)

Scheduled: Wed Oct 7 · Status: new · Size: M · PRD: P0-6.1, R6

Depends on: N1

Fixture path: Pure core; CMS ICD-10-CM public files committed under data/codes.

Founder blockers: none

Why: P0-6's codes are machine-suggested, so the time rule and add-on rules must run before Approve. Split from N9 so the pure rules are test-first and small. Line evidence stores only segment ids, so a kept note never carries transcript text.

#### Scope

**Note model** (src/core/notes/model.ts)
- NOTE_FORMATS and SECTION_KEYS.
- `NoteBody {format, sections[{key, lines[{id, text, source: scribe|dictation|typed|clinician, evidence?: {segmentIds[]}}]}], gaps}`. Evidence holds segment ids only, never text.
- NoteCodes, `toPlainText`.
- `formatFor(profile, encounterOverride?)`.

**Code rules** (src/core/codes/psychotherapy.ts)
- By minutes: under 16 → none; 16–37 → 90832; 38–52 → 90834; 53+ → 90837.
- Add-ons 90833/90836/90838 only with an E/M; 90785 only with psychotherapy.
- Intake 90791 (no medical services) and 90792 (with medical services, prescriber credentials only).
- Family 90846 (without the patient) and 90847 (with the patient).
- `codeIssues(codes, durationMin, credential)` flags a time-based code that doesn't match the duration, and 90792 for a non-prescriber.
- `durationFrom(encounter)` uses the clinician-stated start and stop.

**ICD-10**
- src/core/codes/icd10.ts `isBillableIcd10` over data/codes/icd10cm-<fy>.json, built by `bun run codes:build` from CMS's public ICD-10-CM files and committed.

#### Acceptance

- [ ] note-model.test.ts: each format produces its sections in order; evidence accepts segment ids and rejects text (zod)
- [ ] psychotherapy.test.ts: time rule at 15, 16, 37, 38, 52 and 53 minutes; a 48-minute session suggests 90834
- [ ] psychotherapy.test.ts: an add-on without an E/M is rejected; 90785 without psychotherapy is rejected
- [ ] psychotherapy.test.ts: intake cases (90791 for an LCSW, 90792 allowed for an MD and flagged for an LCSW) and family cases (90846, 90847)
- [ ] code-issues.test.ts: 90837 on a 48-minute session produces one blocking issue naming the code field
- [ ] format.test.ts: formatFor returns the profile default and honours a per-encounter override
- [ ] icd10.test.ts: non-billable codes are rejected; billable ones pass

### [ ] N9b — Notes service and screen: generate, edit, approve, then copy (absorbs S25's code checks)

Scheduled: Wed Oct 7 · Status: new · Size: L · PRD: P0-6.1, P0-6.2, P0-6.3, P0-9.2, R6

Depends on: N8, N9a, S4, N5

Fixture path: Fixture LlmProvider returns canned notes and codes for the synthetic typed inputs.

Founder blockers:

- F5 Bedrock for real notes
- F6 for synthetic quality runs
- F4 Q-L3 to confirm the progress vs psychotherapy line
- D2 item 3 (Copy after Approve)

Why: P0-6 and story 3 are what clinicians pay for, and an approved note is what files the claim. 'Nothing leaves Ferry until Approve' is taken literally: Copy works after Approve. The progress vs psychotherapy distinction exists from the first note (Q-L3).

#### Scope

**Table** notes (not_)
- client_id; encounter_id UNIQUE
- kind 'progress' (the enum reserves 'psychotherapy'; none are created)
- format; status generating|draft|approved|failed
- body, generated_body (immutable), codes, suggested_codes (all sealed)
- start_time, stop_time, signed_name, credential (payer records checklist)
- model_id, prompt_version, generated_at, approved_at

**Services** (ClinicianOnlyCtx)
- `generateNote(SystemCtx, encounterId)` runs as a job with an id-only payload:
  - input: the typed or dictated transcript, or a scribe note body (N11)
  - format from formatFor; text via llmFor(ctx).generate
  - code suggestions from Bedrock, filtered through the N9a rules and isBillableIcd10
- getNote, editLine, setCodes (validated the same way).
- regenerate, only while the transcript is unexpired.
- `approveNote`: requires requireEntitlement(canApproveNotes) and no blocking codeIssues; emits note_approved; the note is read-only after.
- noteText.

**Screen** (/app/sessions/[id], the docs/spec.html phone frame and 1280 px)
- 'Here's <first name>'s note.', duration chip, tap-to-edit lines, editable code chips with inline issues.
- One primary button, 'Approve note'. 'Copy note' appears once approved.
- GET and PATCH /api/v1/notes/[id]; POST /api/v1/notes/[id]/approve.

#### Acceptance

- [ ] notes.test.ts: line edits persist and generated_body never changes; copied text has every section, the codes and the date, with no markup
- [ ] notes.test.ts: Copy is refused before Approve; an approved note is read-only; a double approve emits exactly one note_approved; a read-only tenant cannot approve
- [ ] notes.test.ts: after the transcript expires, regenerate is refused and the note is untouched
- [ ] note-format.test.ts: a profile defaulting to BIRP produces BIRP from typed input; a per-session override to SOAP produces SOAP
- [ ] code-issues.test.ts: a clinician edit to 90837 on a 48-minute session blocks Approve with one named field
- [ ] icd10.test.ts extended: non-billable suggestions are dropped before display; clinician edits are validated the same way
- [ ] traffic.test.ts: generate, edit and regenerate make zero clearinghouse, fax or outbound-email calls (spies)
- [ ] llm-no-taxid.test.ts: across demo:seed note generations, the fixture provider's recorded inputs contain no seeded Tax ID
- [ ] erasure.test.ts extended: at +24h, decryptedDump(tenant) contains no marker that appeared only in the typed transcript (notes keep only what the clinician approved)
- [ ] marker.test.ts: note text never appears in any /c page, client action or client API output; ctx.test.ts: the notes repo rejects a ClientCtx at compile and run time
- [ ] e2e/note.spec.ts at 390 and 1280 px: type rough notes → note appears → edit a line → change a code → approve → copy

### [ ] S8 — Claim from note and the 837P builder (test-first)

Scheduled: Thu Oct 8 · Status: modified · Size: L · PRD: P0-8.1, P0-8.2, P0-3.2, R10

Depends on: N9b, N5, S6b, S10, N7b

Fixture path: Pure core plus Stedi's schema snapshot in the repo.

Founder blockers: F2 to run Stedi claim edits in test mode (a zod shape check until then)

Why: P0-8 turns an approved note into a claim under the invariants that must never break: client as payee, CLM07=C, CLM08=N, Box 13 blank. Claims are now machine-built, so a mapping error would repeat on every claim. Missing patient or subscriber demographics would get every claim rejected.

#### Scope

**Claim from note** (src/core/claim/from-note.ts)
- `buildClaimFromNote({note, encounter, profile, fees, plan, client})` returns ClaimDraft | {missingFee}:
  - lines are codes × chargeFor
  - POS 11 in person; telehealth POS 10 with modifier 95 unless PayerRules says GT
  - date of service from the encounter
  - diagnosis pointers per line
  - billing party from billingParty
  - plan, patient and subscriber snapshots

**837P** (src/core/x12/837p.ts)
- `toStedi837P`: planParticipationCode 'C', benefitsAssignmentCertificationIndicator 'N', Box 13 blank.
- Subscriber (2010BA) and patient (2010CA) name, address, DOB and sex.
- A 14-character patientControlNumber derived from the clm_ id.

**Validation** (src/core/validation/validate.ts)
- `validate(claim, payerRules)` returns Issue[] of {field, fixBy: clinician|client|staff, message}.
- A zod request schema derived from Stedi's public OpenAPI, snapshotted in fixtures/stedi/openapi.

#### Acceptance

- [ ] clm-invariants.property.test.ts (fast-check over generated note-built claims): CLM07='C', CLM08='N', Box 13 blank, client as the subscriber/patient payee
- [ ] from-note.snapshot.test.ts: one snapshot per synthetic note fixture (at least 6), covering billing vs rendering, dependents, multiple lines, units, up to 4 modifiers and pointers
- [ ] from-note.test.ts: charge = fee × units; a missing fee returns {missingFee}, never a $0 line
- [ ] telehealth.test.ts table: the default is POS 10 + 95; a payer requiring GT gets GT
- [ ] validate.test.ts: blocks draft → ready on any error and names one field and who fixes it (member ID, patient address or sex, or subscriber fields → client; fee, code or NPI → clinician)
- [ ] validate.test.ts: a claim without the subscriber address is blocked with field subscriber.address, fixBy client; no claim can be built for a gated plan type
- [ ] stedi-schema.test.ts: every built request parses against the OpenAPI-derived schema
- [ ] log.test.ts extended: the Tax ID appears only inside the 837P payload, never in logs

### [ ] S9 — Submission, 277CA, channel selection, member-form fallback, clinician claim DTO and minimal staff ops

Scheduled: Thu Oct 8 · Status: modified · Size: L · PRD: P0-8.1, P0-8.2, P0-8.4, P0-3.3, R10

Depends on: S8, S10, S4, N5, S3b, S6b

Fixture path: fixtures/stedi/277ca/*.json on the dev clock; scenario tags on synthetic member IDs.

Founder blockers:

- F2 Stedi paid account and test key (test claims to the Stedi Test Payer)
- F1 plus Stedi production, BAA and per-NPI enrollment for beta clinicians, submitted by Oct 9
- Stedi's confirmation that Ferry may submit under members' NPIs
- F4 Q-L1 before any live claim
- D2 item 11 (clinician prints and mails member forms)

Why: P0-8 filing. The fixture clearinghouse makes the whole loop demonstrable with no Stedi account. The member-form fallback keeps beta claims moving while a clinician's enrollment with a payer is pending (up to 30 days). The clinician sends it, so staff never handle PHI papers and the claim never shows 'sent' before it is. The first staff tasks appear here, so the minimal staff tools land here too.

#### Scope

**Clearinghouse integration** (src/server/integrations/clearinghouse, chosen by modeFor('clearinghouse'))
- `submitProfessionalClaim(req, idempotencyKey)`, `parse277CA`, `listInbound(since)`, and the webhook /api/webhooks/stedi.
- fixture:
  - validates the request and asserts CLM07 and CLM08
  - returns correlationId fx-<hash>
  - queues 277CAs on the dev clock: Stedi A1/20, then payer A2/20
  - A3/A7 rejections and a 400 claim edit are chosen by a scenario tag on the synthetic member ID
- test and live share one code path.

**Submission**
- An S10 effect, logged in external_calls with an idempotency key (the 837P sealed as a kept record).
- `map277CA` is idempotent over several 277CAs per claim; the tenant is found through resolvers.ts.
- Rejection fix classes:
  - auto: corrected and resent with frequency code 7, only when the diff touches no CPT, ICD-10, modifier, units, charge, date of service or pointer; otherwise it becomes a clinician task
  - clinician, client, staff
- Clinician cancel works until accepted and sends frequency code 8 only for a submitted claim.

**Channel selection**
- `selectChannel(payer, enrollment)` returns electronic | member_form. member_form applies when the payer has no 837P support or enrollment isn't active.
- src/lib/packet.ts moves to src/server/documents/packet.ts, rewritten with the clinician's billing party, the client as payee and 'Assignment of benefits: None — pay subscriber directly'. It is rendered on demand for ClinicianCtx only.
- A member_form claim stays in ready with client copy 'Waiting to be mailed', and one clinician task 'print and mail' opens. The event mailed_by_clinician (or a fax confirmation from S14) moves it to submitted.

**Clinician claim views**
- Strict DTO in src/core/api/claims.ts exposing tax_id_last4 only.
- Stedi's CMS-1500 PDF is fetched on demand for ClinicianCtx and never stored.

**Staff ops (minimal)**
- src/server/db/repos/ops.ts (ids, kinds, ages and counts) and `staffActFor(staff, taskId)` (audited) in services/ops.ts.
- `bun run tasks:list --staff`.

**Live gate**
- Live submission requires `assertLiveLegal(['npi_filing_authorization','client_filing'])`, `liveFilingAllowed(profile)` and `requireFilingConsent`.

#### Acceptance

- [ ] submit.test.ts (fixture): ready → submitted → accepted with no manual step, one claim_events row per transition; a retried submit job with the same idempotency key submits once
- [ ] map277ca.test.ts: duplicate or out-of-order 277CAs don't double-apply
- [ ] rejections.test.ts table: auto resends once with frequency code 7; a correction whose diff touches a clinical field becomes one clinician task instead; clinician or client opens exactly one task for that audience; staff raises an exception task
- [ ] clm-invariants.property.test.ts extended: corrected (frequency 7) and cancel (frequency 8) requests keep CLM07='C', CLM08='N', Box 13 blank and the client as payee
- [ ] cancel.test.ts: works before accepted, refused after with plain copy
- [ ] channel.test.ts: a payer with pending enrollment or no 837P support routes to member_form; the claim stays ready with 'Waiting to be mailed'; one clinician task opens; mailed_by_clinician moves it to submitted with one notify
- [ ] packet.test.ts: every rendered packet shows assignment None, a blank insured payment authorization (Box 13) and the client as payee
- [ ] dto.test.ts: the clinician claim DTO has tax_id_last4 and no full Tax ID; a ClientCtx gets 404 for the packet and the CMS-1500 PDF routes
- [ ] ops.test.ts: tasks:list --staff prints ids, kinds and ages only; staffActFor writes an audit row; a StaffCtx is refused by every tenant repo
- [ ] live-gate.test.ts: live mode refuses while legal texts are placeholders or identity is unverified
- [ ] webhook-stedi.test.ts: the secret is checked; an unknown PCN gets 200 and is logged by id only

### [ ] N10 — Claims from approved notes: filing gate, auto-file, consent-withdrawal handler, claim card

Scheduled: Fri Oct 9 · Status: new · Size: M · PRD: P0-8.1, P0-6.3, P0-4.2, R10

Depends on: N9b, S9, N7b, N6, S3b

Fixture path: All fixture vendors.

Founder blockers: D2 item 7 (withdrawal stops unsent claims only)

Why: Story 4 and P0-8: approving a note files the client's claim. This closes the loop the M1 walkthrough proves, and it proves the inverse: nothing reaches an insurer before Approve.

#### Scope

**Core** (src/core/claim/filing-gate.ts)
- `filingGate({filingConsent, plan, gatedPlanType, benefits: oon|no_oon|unknown, entitlements, authorization, npi: confirmed|unconfirmed|unknown, clearinghouseMode})` returns one of:
  - file
  - wait {reason, ask: client|clinician}
  - block {reason, tell: both}
- Benefits 'unknown' files until S7 turns the check on.
- npi 'unknown' files when the clearinghouse mode is fixture or test, and waits when live; S6 sets confirmed or unconfirmed.

**Services** (src/server/services/claims-from-notes.ts)
- `fileApprovedNote(SystemCtx, noteId)` runs on note_approved. It is idempotent via claims.note_id UNIQUE.
- `fileWaiting(SystemCtx, clientId)` runs as a job when a consent or plan arrives, within timely filing.
- The consent_withdrawn(client_filing) handler applies filing_consent_withdrawn to that client's draft and ready claims.

**UI**
- A missing fee is asked for inline on the note screen once and saved to the fee schedule.
- A claim card on the note screen; /app/claims; a claims tab on /app/clients/[id].

**Data**
- claims gains note_id and encounter_id.
- A same-day filing metric query.

#### Acceptance

- [ ] file-note.test.ts (fixture): consent + plan + approve → draft → ready → submitted → accepted on the same fake day
- [ ] no-insurer-traffic.test.ts: clearinghouse, fax and letter spies see zero calls through encounter → typed → draft note → edits → regenerate, then exactly one submit after Approve
- [ ] file-note.test.ts: a double approve or a retried job yields exactly one claim
- [ ] file-note.test.ts: a missing plan or filing consent makes the claim wait; the client gets one 'One quick thing' task; supplying it files automatically through a job
- [ ] file-note.test.ts: withdrawn filing consent cancels that client's draft and ready claims, creates no new claim, and leaves submitted claims moving
- [ ] file-note.test.ts: a read-only tenant can't approve, and already-filed claims keep moving; a new plan after filing leaves the filed claim's snapshot unchanged
- [ ] filing-gate.test.ts: table over every input combination, including npi 'unknown' × clearinghouse mode fixture (file) and live (wait)
- [ ] missing-fee.test.ts: a code without a fee asks the clinician once inline and saves the answer
- [ ] metrics.test.ts: on demo:seed the query returns the share of approved notes for insured clients filed the same day

### [ ] S12 — Client tracker, confirm arrived, and the M1 thin-path walkthrough (Gate C)

Scheduled: Fri Oct 9 · Status: modified · Size: L · PRD: P0-9.1, P0-9.2, P0-8.4, R12

Depends on: N10, S10, S3c, N7b

Fixture path: demo:seed plus fixture vendors; worker and dev clock through the e2e harness.

Founder blockers:

- Question 3: should clients see the diagnosis code on their own claim (default hidden)?
- D2 item 2 (letter metadata only)

Why: P0-9 and stories 10, 12 and 13: the only thing a client sees. Its Playwright walkthrough proves the whole thin path works end to end on fixtures, 9 days before the freeze.

#### Scope

**Copy and API**
- src/core/claim/copy.ts `copyFor(state, audience: client|clinician, facts)` for all 16 states. Segment labels follow the S3c §13 draft.
- src/core/api/trips.ts strict DTOs:
  - id, clinicianDisplayName, payerName, serviceDate, amountCents, chip, segments, stateLine, eta
  - timeline[{state, at, copyKey}]
  - lettersSent[{kind, payerName, sentAt}]
  - details {reference, cptPlain, amounts}
  No diagnosis field, no note field, no letter body, no Tax ID.

**Services** (services/trips.ts)
- `listTrips(self)` iterates memberships; `getTrip(self, membershipId, claimId)`.
- `confirmArrived(ClientCtx, claimId)` is allowed only in paid or partially_paid, and moves the claim to closed with one notify.

**Routes and seed**
- /c, /c/trips/[id] (with an 'It arrived' action when allowed), GET /api/v1/trips and /api/v1/trips/[id].
- demo:seed covers all 16 states for both audiences.

#### Acceptance

- [ ] e2e/m1-thin-path.spec.ts (Gate C), clinician at 1280 px and client at 390 px: Start free → onboarding → add client → client opens the invite from data/outbox, consents, enters insurance → clinician types rough notes → note → Approve → Copy → claim accepted → the client's /c shows the trip
- [ ] marker.test.ts extended: no client page, action or trips output contains note text, transcript text, diagnosis codes or letter bodies
- [ ] trips.test.ts: A1 never sees A2's trips; U sees both clinicians' trips merged by date
- [ ] trips.test.ts: confirmArrived is refused in every state except paid and partially_paid, and moves paid → closed with exactly one claim_event and one notify; 'It landed' fires only from it
- [ ] copy.test.ts: demo:seed renders all 16 states in both audiences; banned-vocabulary.test.ts (FERRY_BRAND §2) passes over all client copy
- [ ] trips.test.ts: lettersSent lists only sent letters, as metadata
- [ ] e2e/m1-thin-path.spec.ts: no WCAG AA violations (axe) on /c and /c/trips/[id]; keyboard navigation works; no request to a third-party origin on any walkthrough page

### [ ] N11 — Scribe and dictation integration: HealthScribe for recordings, Transcribe Medical for dictation, corpus, scribe:eval

Scheduled: Sat Oct 10 · Status: new · Size: L · PRD: P0-5.1, P0-6.1, P0-11.4, R5, R6

Depends on: S4, N9b, S3b

Fixture path: Fixture Scribe plus the synthetic session corpus; AWS SDK and S3 mocked. The live eval runs the day F5 lands.

Founder blockers:

- F5: AWS account and BAA; HealthScribe and Transcribe Medical in us-east-1; S3 output bucket, KMS key, IAM role; a quota increase for concurrent streams and post-stream analytics jobs (default 1)
- D5 recording-cost decision (Oct 4; revisit after the live eval)

Why: P0-5 and the Q-E1 decision (commit e9e5f9b): HealthScribe writes notes from recordings, and Claude on Bedrock writes the codes and the notes from dictation and typing (docs/prd.md:176). Dictation needs a transcript-only path. HealthScribe's quality, latency, quotas and cost are unmeasured, so this slice also gives Ryan numbers for D5.

#### Scope

**Interface** (src/server/integrations/scribe, chosen by modeFor('scribe'))
- `Scribe.open({purpose: 'record'|'dictation', sessionId, template?, sampleRateHz: 16000, resume}) → {write(pcm), pause(), end(), onTranscript(segment)}`.
- Also `endAbandoned`, `result(sessionId) → {status, transcript?, note?}`, `purge(sessionId)`.
- `note` is optional, which lets record mode move to Transcribe plus Claude if D5 goes that way.

**Implementations**
- fixture:
  - counts PCM ms
  - record returns a synthetic session's transcript and note in HealthScribe's JSON shape after end()
  - dictation returns transcript segments only
  - configurable delay; faults: drop, LimitExceeded, analytics failed, note absent
- live (@aws-sdk/client-transcribe-streaming):
  - record: StartMedicalScribeStream and GetMedicalScribeStream; a ConfigurationEvent first; pcm, 16 kHz, en-US; UUID SessionId; KMS key, ResourceAccessRoleArn and OutputBucketName from env
  - dictation: StartMedicalStreamTranscription (type DICTATION, transcript only, nothing written to S3)
  - region must be us-east-1
  - @aws-sdk/client-s3 reads and then deletes the HealthScribe outputs
  - `open()` in live mode calls assertLiveLegal(['baa','client_recording']) for record and assertLiveLegal(['baa']) for dictation

**Core and notes**
- src/core/scribe/healthscribe.ts: zod schemas for the output files.
- templates.ts maps soap→BEHAVIORAL_SOAP, dap→DAP, birp→BIRP, intake→HISTORY_AND_PHYSICAL, from formatFor.
- `toNoteBody` keeps HealthScribe evidence as segment ids only.
- N9b's generateNote accepts a scribe body (then asks Bedrock for codes only) or a dictation transcript (then asks Bedrock for the note and codes).

**Corpus**
- corpus/synthetic/sessions/*.json: GAD follow-up 48 min (DAP), depression (BIRP), psychiatry med check (SOAP), intake, family, interrupted, and a 60-second dictation.
- Each lists the facts a note must contain and must not invent.

**scribe:eval** (scripts/scribe-eval.ts, `bun run scribe:eval --mode fixture|live`)
- Live mode refuses unless FERRY_DATA_CLASS=synthetic. It renders sessions to audio with macOS `say` and streams them at real-time pace.
- Reports:
  - end-of-stream → note p50/p95
  - required-fact recall and invented facts
  - monthly cost at 20×50 minutes a week for HealthScribe vs Transcribe plus Claude
  - quotas via the Service Quotas API
- Writes corpus/results/scribe-<ts>.json and docs/plans/scribe-eval.md with a plain-language D5 recommendation.

#### Acceptance

- [ ] scribe-fixture.test.ts: record mode, PCM in, end(), then result() completes with the chosen session's transcript and note; audio ms counted
- [ ] scribe-fixture.test.ts: dictation mode returns transcript segments and no note
- [ ] scribe-live.test.ts (mocked SDK): record sends a ConfigurationEvent first, pcm/16000/en-US, config from env, template mapped from formatFor; dictation calls StartMedicalStreamTranscription with type DICTATION
- [ ] scribe-live.test.ts: any region other than us-east-1 throws; open() refuses while baa or client_recording is a placeholder (record) or baa is a placeholder (dictation)
- [ ] scribe-live.test.ts: resume reuses the SessionId; endAbandoned reopens and sends END_OF_SESSION; ConflictException maps to 'streaming elsewhere'; LimitExceeded retries with backoff
- [ ] scribe-live.test.ts: purge deletes both S3 objects (mocked S3)
- [ ] healthscribe-schema.test.ts: every corpus output parses; malformed output is rejected; toNoteBody keeps section order, and its evidence holds segment ids with no transcript text
- [ ] note-from-scribe.test.ts: a scribe body for the 48-minute session gets codes from the fixture Bedrock provider, filtered by the N9a rules, with 90834 suggested
- [ ] scribe-types.test.ts: a result without a note type-checks only when callers handle it
- [ ] scribe-eval.test.ts: fixture mode produces the full report deterministically; live mode refuses without FERRY_DATA_CLASS=synthetic

### [ ] N12 — Capture relay: phone to HealthScribe or Transcribe, intervals, consent kill switch, dictation cap, resume, lease, import, metering

Scheduled: Sat Oct 10 · Status: new · Size: L · PRD: P0-5.1, P0-5.2, P0-5.3, P0-5.6, P0-4.2, R4, R5, R9

Depends on: N3a, N11, N8, N9b, S10, S3b

Fixture path: Fixture Scribe; tests stream synthetic PCM over a real local ws connection.

Founder blockers:

- F5 for live HealthScribe and Transcribe Medical
- Q-L2 attorney answer before any real recording

Why: Browsers can't hold HealthScribe's signed HTTP/2 stream, and Next route handlers can't hold WebSockets, so the relay carries the audio. This slice delivers P0-5's 'keep what was captured, mark the gap' and 'audio never written'. Consent withdrawal must stop a live recording, and dictation must not become an unconsented recording.

#### Scope

**Relay** (src/server/relay/{main, server, session}.ts, extending N3a)
- Accepts only a 60-second HMAC token bound to {captureId, tenant}, issued by POST /api/v1/captures after a session check.
- Re-checks recording consent (record mode) and entitlement on every connect.
- LISTENs on 'consent_withdrawn': an active record-mode capture for that client ends within 5 seconds with end_reason consent_withdrawn; what was captured imports.
- Dictation captures are capped at 5 minutes (end_reason limit).
- Transcript segments are held in memory and written only through `importDictation(SystemCtx, captureId)` or `importScribeResult`, never logged or written elsewhere.

**Intervals and resume**
- capture_intervals (civ_): capture_id; seq; started_at; ended_at; audio_ms_from; audio_ms_to; end_reason stopped|disconnected|interrupted|backgrounded|limit|consent_withdrawn; unique (capture_id, seq).
- A disconnect pauses the scribe stream; a reconnect resumes the same SessionId.
- With no reconnect in 15 minutes, a keyed S10 timer calls endAbandoned.
- The encounter's start and stop are prefilled from the first interval start and the last interval end.

**Lease**
- captures.relay_lease_owner and lease_expires_at ensure one relay instance holds a capture. A second connection takes over and closes the first.

**Import**
- `importScribeResult(SystemCtx, captureId)` runs as a job: stores the transcript (24-hour expiry), hands the scribe note to generateNote, purges S3 and sets outputs_purged_at. A failed purge retries.
- `importDictation` stores a kind 'dictation' transcript (24-hour expiry) and enqueues generateNote.
- A purge-overdue check: a capture ended more than 1 hour ago with outputs_purged_at null logs `alert.purge_overdue` and opens one staff task.

**Limits and metering**
- src/core/capture/limits.ts: record warns at 110 minutes and stops at 120; dictation stops at 5.
- audio_ms summed per tenant per month.

#### Acceptance

- [ ] relay.test.ts extended: missing, expired, forged, wrong-capture and cross-tenant tokens are refused
- [ ] consent-kill.test.ts: withdrawing recording consent during an active record-mode capture closes it within 5 s with end_reason consent_withdrawn; the captured part imports; a reconnect is refused
- [ ] dictation-cap.test.ts: a dictation capture stops at 5 minutes with end_reason limit; record mode is unaffected
- [ ] intervals.test.ts (fixture): two drops give two gaps with times and reasons; audio_ms equals the sum of intervals; encounter times prefill from the span
- [ ] abandon.test.ts (dev clock): no reconnect for 15 minutes calls endAbandoned, and the captured part imports
- [ ] lease.test.ts: a second relay instance cannot claim a leased capture; a takeover closes the first connection with no conflict loop
- [ ] no-audio.test.ts: spies on fs, the DB layer, log() and external_calls see zero audio bytes and no transcript-segment text outside the transcripts table during a fixture capture
- [ ] import.test.ts: transcripts are sealed with expires_at = created + 24h; outputs_purged_at is set; the mocked S3 delete is called; a failed purge retries; purge-overdue fires once after 1 hour
- [ ] erasure.test.ts extended: at +24h after a fixture recording, rawDump and decryptedDump contain no transcript marker
- [ ] metering.test.ts: monthly audio minutes per tenant can be queried; limits.test.ts: warn at 110 minutes, stop at 120

### [ ] N13 — Record and dictate in the browser (M2)

Scheduled: Sun Oct 11 · Status: new · Size: L · PRD: P0-5.1, P0-5.2, P0-5.6, P0-4.3, P0-6.1, R4, R5

Depends on: N12, S18a, N9b, N3b

Fixture path: Fixture Scribe behind the relay; phones reach dev through bun run dev:phone.

Founder blockers:

- Ryan: a 10-minute device test on Sun Oct 11 evening, role-play only, no real client audio
- F5 for live HealthScribe

Why: Stories 1, 2 and 8: the headline feature. It lands in time for Ryan's real-phone test on the full product path on Oct 11, with the buffer behind it.

#### Scope

**Capture hook** (src/ui/capture/use-capture.ts, built on N3b's worklet and recorder)
- A ws connection to the relay.
- An in-memory ring buffer of up to 5 minutes, replayed after a short drop and de-duplicated by seq. Never IndexedDB.
- Screen Wake Lock held while recording. An interruption closes an interval with its reason. Stop releases every track.

**Screens**
- /app/sessions/[id]/record and /app/sessions/[id]/dictate, with RecordButton's level meter and timer.
- Record is disabled, with a reason, when there is no recording consent. Dictate shows its 5-minute limit.
- A gap banner on the note screen offers 'Dictate the rest', which opens a dictation capture and merges its lines through LlmProvider.generate (source 'dictation').
- The 'Audio deleted' chip appears only once the stream has ended and outputs_purged_at is set.

**Dev login**
- `bun run dev:login <email>` (assertDevTier) prints a QR code of a one-time magic-link URL from the email fixture for signing in on a phone over dev:phone.
- dev:phone exports BETTER_AUTH_URL and a trustedOrigins entry for the tunnel origin.

#### Acceptance

- [ ] e2e/record.spec.ts (Chromium fake media fed a synthetic session WAV): record 30 s → stop → the note appears with 'Audio deleted', code chips, and a duration chip equal to the capture span
- [ ] e2e/record.spec.ts: a 5-second hidden tab produces a gap; 'Dictate the rest' appends lines with source dictation
- [ ] e2e/record.spec.ts: Record is disabled with a reason for a client without recording consent; dictation works
- [ ] e2e/dictate.spec.ts: fake-media playback of the 60-second corpus dictation → a note in the clinician's default format containing that session's required facts (fixture) and suggested code chips
- [ ] ring-buffer.test.ts: replay after a 30 s drop produces no duplicate audio ms
- [ ] no-persist.test.ts: grep finds no capture attribute, IndexedDB, download or share call in src/ui/capture; every track stops after Stop
- [ ] dev-login.test.ts: refuses outside the dev tier
- [ ] Founder check (Oct 11): installed app on iOS 18.4+ and Android, plus a Safari tab. A 5-minute synthetic role-play with one screen lock and one incoming call; gaps shown and a note produced; recorded in the device matrix.

### [ ] S6 — NPPES lookup, clinician verification and identity:verify

Scheduled: Sun Oct 11 · Status: modified · Size: M · PRD: P0-3.1, R10

Depends on: N5, N10, S9

Fixture path: fixtures/nppes; the corpus NPIs don't exist in the real registry.

Founder blockers: Question 8: who runs identity:verify during beta

Why: P0-3 checks the NPI against NPPES. Ferry files under the member's NPI, so impersonation has to be blocked before the first real claim. liveFilingAllowed needs identity_verified_at, so something must set it.

#### Scope

**Lookup**
- src/server/integrations/nppes, chosen by modeFor('nppes'). Live and test are the same public API v2.1 with no key.
- fixtures/nppes/<npi>.json covers:
  - LCSW, LPC, PsyD and MD NPI-1 entries
  - an NPI-2 group
  - a deactivated NPI
  - a non-behavioral taxonomy
  - an outage
- nppes_providers is a GLOBAL_TABLES cache with a 30-day TTL.

**Profile and rules**
- The lookup prefills the N5 profile, and the clinician confirms it.
- Sets nppes_checked_at and nppes_name_match (src/core/npi.ts `nameMatches`), and the filingGate npi input to confirmed or unconfirmed.
- src/core/taxonomy.ts `isBehavioralTaxonomy`. NPI-1 is required as rendering provider.
- An outage never blocks sign-up, trial, capture or notes; filing waits instead.

**identity:verify**
- `bun run identity:verify <npi>`: staff-only through staffActFor, audited, sets identity_verified_at. It refuses an NPI without nppes_name_match.

#### Acceptance

- [ ] nppes.test.ts: a bad check digit is rejected before any network call (fetch spy)
- [ ] nppes.test.ts: a fixture prefill fills name, credential, taxonomy, address and phone; the clinician's edits persist
- [ ] nppes.test.ts: a deactivated NPI or non-behavioral taxonomy blocks filing with a plain reason; notes still work
- [ ] nppes.test.ts: a name mismatch makes filing wait and opens one clinician task (client_id null)
- [ ] nppes.test.ts: in the outage fixture, onboarding completes and filingGate returns wait
- [ ] identity-verify.test.ts: sets identity_verified_at and writes an audit row; refuses without nppes_name_match; refuses a non-staff caller
- [ ] nppes-cache.test.ts: a second lookup inside the TTL makes no network call; taxonomy.test.ts and name-match.test.ts are table-driven
- [ ] nppes.test.ts: the synthetic corpus NPIs in scripts/corpus/data.ts resolve through fixtures

### [ ] S7 — Eligibility (270/271) and the out-of-network gate

Scheduled: Mon Oct 12 · Status: modified · Size: M · PRD: P0-8.3, R10

Depends on: S9, N10, N7b

Fixture path: Hand-written 271 fixtures keyed by synthetic member IDs.

Founder blockers:

- F2 Stedi test key
- D2 item 4 (automatic benefits check)

Why: P0-8 and edge case 14: with no out-of-network benefit, filing is blocked and both people are told. It also gives the client an estimate. The 270 is automatic insurer traffic, so it is allowed only after both consents, carries no clinical content, and is named in the invariant.

#### Scope

**Eligibility call**
- clearinghouse.eligibility against Stedi's current eligibility-check endpoint (confirm the version in this slice), with STC A6 and a 30 fallback, a timeout, and graceful degradation.
- fixtures/stedi/271 are keyed by synthetic member ID: FX-OON-OK, FX-OON-NONE, FX-HMO, FX-INACTIVE, FX-PAYER-DOWN. Each is validated against the OpenAPI snapshot. Stedi's mocks have no mental-health or out-of-network data, so these are hand-written.

**Results**
- Pure `summarizeBenefits`; `estimateReimbursement` with the clinician's fee as the charge; `deductibleProgress` for the client home (S18).
- eligibility_checks: tenant- and client-scoped, sealed payload, clinician-only repo.

**When it runs**
- As a job after insurance is saved and on card confirm (S5), including when a client triggers it.
- Requires the client's current client_filing consent and the clinician's current npi_filing_authorization. Counted per tenant.
- Feeds filingGate's benefits input, with copy for both audiences.
- If the payer is down, filing proceeds with benefits unknown and retries later.

#### Acceptance

- [ ] eligibility.test.ts: FX-OON-NONE means no claim reaches ready; the clinician sees why on the note screen; the client gets one plain message; the note still saves
- [ ] eligibility.test.ts: FX-OON-OK shows deductible remaining and coinsurance at the clinician's fee
- [ ] eligibility.test.ts: FX-PAYER-DOWN files with benefits unknown and schedules a retry
- [ ] eligibility.test.ts: refused without the client's filing consent or the clinician's authorization; the per-tenant counter increments
- [ ] eligibility.test.ts: a client-triggered check runs as a job under SystemCtx, never in the client's request
- [ ] eligibility-request.test.ts: the 270 request contains no diagnosis, procedure or note fields
- [ ] raw-dump.test.ts extended: eligibility payloads are sealed
- [ ] fixtures-schema.test.ts: every 271 fixture validates against the OpenAPI snapshot
- [ ] With F2: Stedi mock subscribers for 5 payers recorded as fixtures (describe.skipIf without the key)

### [ ] S5 — Insurance card reading: front and back, server-side quality verdict, never stored, confirm before save

Scheduled: Mon Oct 12 · Status: modified · Size: L · PRD: P0-7.1, P0-7.2, P0-7.3, R7, R8, R9

Depends on: S4, N7b, S7, N8

Fixture path: corpus/synthetic cards (front, back and a new cropped fixture) with labels.json through the fixture LlmProvider, matched by sha256 or fixtureCase.

Founder blockers:

- F6 for synthetic real-model accuracy
- F5 Bedrock for real cards
- F9 de-identified real cards (scored only through Bedrock)

Why: P0-7 and story 6: nobody types a member ID. The server-side one-retake verdict is the P0-7.2 proof that survives if S4b's viewfinder slips. Unconfirmed scans must not keep their fields indefinitely.

#### Scope

**Table** scans (scn_)
- user_id = tenant; client_id NOT NULL (CLIENT_SCOPED); actor_user_id
- kind card|insurer_mail|eob; image_sha256[]; attempt; verdict
- fields sealed with sealEphemeral (24-hour key), cleared on confirm
- confirmed_at; first_try_accepted

**Routes and reading**
- POST /api/v1/scans: a multipart route handler (server actions cap bodies at 1 MB), taking one or two images (front, back) and an optional dev-tier-only fixtureCase.
- POST /api/v1/scans/[id]/confirm.
- `readScan(ClinicianCtx|ClientCtx, {kind, clientId, images, attempt})` reads in memory through llmFor(ctx).extract and never calls Storage.
- CardExtraction merges the sides:
  - front: payer, member ID, group, name, plan type
  - back: claims address, payer phone, payer ID, Rx BIN/PCN
  - flags: cardFullyVisible, legible

**Quality verdict**
- src/core/scan/quality.ts `frameVerdict(metrics, attempt)` returns ok | retake | accept_with_flags, shared with S4b.
- The server computes a blur metric (Laplacian variance over a downscaled grayscale decoded with sharp) and uses the extractor's cardFullyVisible flag for cropping.
- One retake, then accept_with_flags.

**Confirm**
- `confirmCard` supersedes the plan (filed claims keep their snapshot), clears the fields, then enqueues S7 eligibility and fileWaiting as jobs.
- Unconfirmed scans crypto-shred at 24 hours through the N8 sweeper (resolvers.expiredScans).

**Screens and cleanup**
- 'Here's what we saw.': only flagged fields ask for attention.
- A camera file input with no capture attribute (S4b adds the live viewfinder).
- Scanning becomes the default in /c/welcome, with typing as the fallback; clinicians scan at /app/clients/[id]/scan.
- Gated cards are explained to both people.
- Remove the card_front and card_back document kinds.

#### Acceptance

- [ ] scans.test.ts: a front and back pair produces one CardExtraction whose claims address and payer ID come from the back
- [ ] scans.test.ts: a blurry synthetic card, then a cropped one (new corpus fixture card-09-cropped), each get exactly one retake, then accept_with_flags
- [ ] scan-storage.test.ts: fs and Storage spies see no file; no documents row; the extract's external_calls row holds no image bytes or base64 prefix; only hashes and verdict remain after confirm
- [ ] scan-expiry.test.ts (dev clock): an unconfirmed scan's fields are unreadable at +24h and its key is destroyed
- [ ] scans.test.ts: nothing saves before Confirm, and the edited fields are what save
- [ ] scans.test.ts: a new card supersedes the plan; a claim filed earlier keeps the old one
- [ ] scans.test.ts: card-06 to card-08 (Kaiser HMO, Medicaid, Medicare) are gated with plain copy; an unresolved payer never reaches a claim as free text, and one task opens for whoever scanned
- [ ] scans.test.ts: works with ClinicianCtx for a client and ClientCtx for self; confirm enqueues eligibility and fileWaiting jobs
- [ ] llm-no-taxid.test.ts extended: card-read inputs contain no Tax ID; raw-dump extended: scan fields are sealed
- [ ] corpus:score --kind card with F6 (describe.skipIf otherwise): member ID ≥ 95% exact and claims address or payer ID ≥ 90% on the synthetic cards; a fixture run doesn't count

### [ ] S4b — Scan camera: live viewfinder, on-device quality check, one retake

Scheduled: Tue Oct 13 · Status: modified · Size: M · PRD: P0-7.2, P0-7.3, R7, R8, R9

Depends on: S5, S18a, S3c

Fixture path: Chromium fake video device with synthetic card images; fixture LLM reads by fixtureCase.

Founder blockers: Ryan: 15 minutes on Wed Oct 14 evening for the photo-library and timed-welcome checks

Why: P0-7: a blurry or cropped scan asks for one retake, and no photo ever lands in the phone's library. On Android a file input can hand off to the camera app, which may keep a gallery copy. If Gate A shows that, this slice becomes never-cut. The old anonymous-draft funnel is dropped.

#### Scope

**Camera** (src/ui/scan-camera.tsx)
- A getUserMedia viewfinder per brand §6: navy, corner brackets, 'Lay it flat.'
- Front, then back.
- Capture stays on one route, to avoid iOS camera re-prompts.
- An 'Upload a PDF' option.

**Quality check**
- Measured on the device: Laplacian variance, corners, glare, fed to the shared `frameVerdict`.
- One retake ('That one's a little blurry. One more try?'); a second bad frame goes to confirmation with flags.

**Upload and privacy**
- Downscale to at most 1600 px JPEG.
- After posting, revoke object URLs and clear the canvas; no download or share calls.
- In the dev tier the page passes `fixtureCase` from its URL, so e2e runs get the fixture read.

#### Acceptance

- [ ] quality.test.ts table for frameVerdict (shared with S5)
- [ ] e2e/scan.spec.ts (Chromium fake video device showing a blurry synthetic card): exactly one retake prompt; a second blurry frame goes to confirmation with fields flagged
- [ ] no-persist.test.ts extended: no capture attribute and no download or share call in scan code
- [ ] e2e/scan.spec.ts: object URLs are revoked and the canvas is cleared after posting
- [ ] e2e/scan.spec.ts at 390 px with fixtureCase: invite → consent → front and back scan → confirm → plan on file
- [ ] scans.test.ts: the first-try acceptance rate can be computed from the scans table
- [ ] Founder check (Oct 14): on an iPhone and an Android phone, nothing lands in the photo library; a timed client welcome (invite → scan → consents), 3 runs, median under 120 s, recorded in docs/plans/capture-device-matrix.md

### [ ] S13 — 276/277 claim-status polling and ETA

Scheduled: Tue Oct 13 · Status: modified · Size: M · PRD: P0-8.4, P0-10.1

Depends on: S9, S10

Fixture path: fixtures/stedi/277 on the dev clock.

Founder blockers: Real behavior only once production claims exist; per-payer claim-status enrollment is tracked in S6b

Why: P0-8's 16-state loop includes status polling. An insurer's request for more information now opens a clinician letter task through S10's openTask; N15 attaches the draft, so neither slice waits on the other. Stedi has no test mode for this, so it can only be proven on fixtures before launch.

#### Scope

**Status check**
- clearinghouse.claimStatus, built to Stedi's schema.
- fixtures/stedi/277/{pending, info_requested_records, info_requested_necessity, paid, partial, deductible, denied_co50, denied_co197, denied_co242, not_found}.json, picked by a per-claim scenario tag.

**Cadence**
- Day 3 after the 277CA, day 21, about day 30, then per payer, via scheduleTimer.

**Mapping**
- Pure `mapStatusResponse`. An unchanged status creates no event and no notification.
- An R-category (request for information) status moves the claim to info_requested and opens one clinician task {kind 'letter', requestType records|necessity, requestRef}.
- Denials go to S17's classifier.
- `etaFor`. Status codes Stedi doesn't bill for are recognized.

#### Acceptance

- [ ] map-status.test.ts: each fixture maps to the right event; an unchanged status creates no event and no notification
- [ ] info-request.test.ts: info_requested opens exactly one clinician letter task with the right requestType, idempotent on requestRef; the client chip stays 'nothing to do'
- [ ] poll-timers.test.ts (dev clock): follows the cadence and cancels on terminal states
- [ ] eta.test.ts: the ETA moves with each poll and never shows a past date

### [ ] S21a — Infrastructure as code, AI opt-out policy, SES sender and boot checks, with no AWS account

Scheduled: Wed Oct 14 · Status: new · Size: M · PRD: P0-11.3, P0-11.4, P0-11.5, P0-5.4, R9

Depends on: N1, S2b, N12

Fixture path: CDK synth and assertion tests plus boot and SES unit tests, all local with mocked clients.

Founder blockers: none

Why: The relay (WebSocket through a load balancer), the HealthScribe output bucket, the DynamoDB key table, KMS, Bedrock logging and the no-training promise are all infrastructure. `cdk synth` needs no account, so the stack and its privacy assertions can be proven in the build window. Staging (S21b) needs a live email sender for magic links, so SES gets exactly one owner, here.

#### Scope

**CDK TypeScript under infra/**
- An org stack: an AWS Organizations AI services opt-out policy (AISERVICES_OPT_OUT_POLICY) covering all services, attached to the root.
- Per environment (staging and prod), everything in us-east-1:
  - ECS Fargate services: web, worker and relay
  - an ALB routing /ws/* to the relay, with WebSocket support, an idle timeout of at least 3600 s, and heartbeats
  - RDS Postgres 17, encrypted, with point-in-time recovery
  - S3: a documents bucket with SSE-KMS, and a HealthScribe output bucket with versioning disabled and a 1-day lifecycle rule on its prefix
  - KMS keys
  - DynamoDB ephemeral-key table: point-in-time recovery off, TTL on, and not selected by any AWS Backup plan
  - IAM roles for HealthScribe and Transcribe; SES outbound; Secrets Manager
  - CloudWatch metric filters and alarms on alert.erasure_lag and alert.purge_overdue
- `bun run infra:synth`.

**Email (SES)**
- src/server/integrations/email/ses.ts: live and test (SES mailbox simulator) behind the existing interface.
- A mocked-client contract test. The send wrapper still runs assertNoPhi.

**Boot checks** (in bootProcess for web, worker and relay)
- In the staging and prod tiers, Bedrock model-invocation logging must be off (GetModelInvocationLoggingConfiguration).

#### Acceptance

- [ ] infra/stack.test.ts (aws-cdk-lib/assertions): all resources are in us-east-1
- [ ] infra/stack.test.ts: the org stack attaches an AI services opt-out policy covering all services
- [ ] infra/stack.test.ts: the HealthScribe bucket has versioning disabled and a 1-day expiry on its prefix
- [ ] infra/stack.test.ts: the DynamoDB key table has point-in-time recovery off, TTL on and no AWS Backup selection; RDS has point-in-time recovery on
- [ ] infra/stack.test.ts: the ALB /ws/* rule targets the relay with an idle timeout of at least 3600 s; alarms exist for alert.erasure_lag and alert.purge_overdue
- [ ] ses.contract.test.ts (mocked SES client): live and test modes send through the wrapper; a body failing assertNoPhi is never sent
- [ ] boot.test.ts extended: a mocked, non-empty Bedrock logging configuration fails boot for web, worker and relay in the staging and prod tiers
- [ ] `bun run infra:synth` passes locally with no AWS credentials

### [ ] S21b — Provision staging and prod on AWS us-east-1; restore and crypto-shred drill

Scheduled: Thu Oct 15 – Fri Oct 16 · Status: modified · Size: L · PRD: P0-11.3, P0-5.5, P0-1.1

Depends on: S21a, S4, N6, S9, N11, N12, N13

Fixture path: Everything provable without an account lives in S21a; this slice is the account-bound part.

Founder blockers:

- F5 by Oct 16 at the latest: an AWS Organization with staging and prod accounts, BAA accepted, Bedrock, HealthScribe and Transcribe Medical access, quotas, SES production access and a domain
- F1 EIN

Why: P0-11: no real data without the BAA stack, and the Nov 2 beta needs production. Staging also gives phones a real HTTPS origin. The 24-hour erasure promise has to hold on real RDS snapshots, not only in tests.

#### Scope

**Deploy**
- Deploy the S21a stacks.
- Staging runs in the staging tier:
  - live AWS providers
  - Stedi and Stripe in test mode
  - sms, fax and storage off
  - FERRY_DATA_CLASS=synthetic
- Prod is deployed in the prelaunch tier (public pages only, every vendor off) and stays there until Gate E.
- `bun run deploy:staging` runs from the Mac. CI (test, typecheck, lint, e2e, synth, deploy staging, manual prod approval) arrives once a private remote exists.

**Checks and drills**
- `bun run smoke:staging` hits /api/health on web, worker and relay, and checks the tier and Bedrock logging.
- `bun run logs:scan --marker <m> --since 1h` exits non-zero if the marker appears in any CloudWatch log group.
- Restore drill: restore a staging RDS snapshot taken while a transcript existed, after that transcript was erased, and prove the restored row can't be decrypted. Written up in docs/runbook.md.
- The N11 scribe:eval live run happens here if it hasn't already.
- Migrations are forward-only from this deploy onward.

#### Acceptance

- [ ] `bun run smoke:staging` exits 0: health checks pass, the tier is staging, and Bedrock invocation logging is off
- [ ] Real-phone check: an iPhone on the installed web app records 5 minutes of synthetic speech through staging's relay to HealthScribe; a draft note appears; the S3 output objects are gone after import
- [ ] Restore drill: the restored snapshot cannot decrypt the erased transcript; written up in docs/runbook.md
- [ ] `bun run logs:scan --marker` over the hour after the phone check exits 0
- [ ] prod-prelaunch.test.ts: prod serves / with 200 and returns 404 for /app, /c, /start and /api/v1; booting prod in the prod tier with any fixture or test vendor fails (staging smoke of the guard)

### [ ] N14 — Freeze walkthrough (Gate D)

Scheduled: Sat Oct 17 · Status: new · Size: S · PRD: P0-2.3, P0-4.2, P0-5.2, P0-6.1, P0-7.2, P0-8.1, P0-8.3, P0-9.1, P0-11.2

Depends on: S12, N13, S4b, S7, S6, N6, S13, S5

Fixture path: All fixture vendors and the dev clock.

Founder blockers: none

Why: The freeze needs proof that the full pre-freeze path works on fixtures, not only the M1 thin path: card scan, benefits check, recording, dictation, closing a paid claim, and the trial running out. It also runs the raw-dump check after the whole path.

#### Scope

**e2e/gate-d.spec.ts** (fixtures, clinician at 1280 px and client at 390 px)
1. Start free.
2. Onboarding with the NPPES prefill.
3. Add a client; the invite is accepted; both consents given.
4. Card scan front and back with one retake, then confirm.
5. Eligibility: FX-OON-OK.
6. Fake-media recording with one gap and 'Dictate the rest'.
7. Note, code edit, approve, copy.
8. Claim accepted; the client sees it.
9. A fixture 277 paid; the client taps 'It arrived'; the trip shows Closed.

**Second pass**
- Trial past day 7 with no card → read-only refusals → card added → access restored.

**After the run**
- rawDump, including pgboss, is checked.
- clock:advance 25h, then decryptedDump for the tenant is checked.

Fixes go in only for bugs this walkthrough finds.

#### Acceptance

- [ ] e2e/gate-d.spec.ts passes three consecutive runs
- [ ] The read-only pass asserts equal row counts before and after the lapse
- [ ] After the run, rawDump (including pgboss) contains none of the seeded client names, DOB, member ID, diagnosis codes, Tax ID, typed-note marker or scan marker; at +25h, decryptedDump contains no typed-note, transcript or scan-image marker
- [ ] Every walkthrough page passes axe with no WCAG AA violations and makes no request to a third-party origin
- [ ] bun run test, typecheck, lint and test:e2e green on main at the freeze

### [ ] S14 — Letter engine: storage, PDF render, fax and clinician print-and-mail routes

Scheduled: Mon Oct 19 · Status: modified · Size: L · PRD: P0-10.2, R11

Depends on: S2b, S10, S6b, S9

Fixture path: Sinch fixture, local encrypted Storage, dev clock.

Founder blockers:

- F8 Sinch account and BAA (both HIPAA storage boxes unchecked)
- Question 4: mail at launch (clinician print-and-mail default, or a mail vendor that signs a BAA, F14)
- D2 item 1 (no electronic letter route)

Why: P0-10.2 needs a route for every approved letter. Stedi supports only unsolicited 275 attachments, so it can't carry a reply to an insurer's request, and there is no mail vendor yet. Staff never handle PHI papers, so the clinician mails and Ferry faxes. The same FaxSender also sends member-form claims.

#### Scope

**Storage and rendering**
- A Storage interface (local encrypted disk; s3 with a mocked contract test), chosen by modeFor('storage'). Sent letter PDFs are the first files it stores.
- src/server/documents/pdf.ts, based on the pdf-lib Writer from packet.ts.
- The clinician's Tax ID and signature block are added at render time, never in a draft or prompt.

**Table** letters (ltr_)
- user_id; client_id; claim_id; task_id
- kind necessity|records|appeal|status_inquiry; status
- sealed body and pdf key
- sent_channel; sent_at; opened_at; first_viewed_at; approved_at; approved_hash
- Clinician-only repo; clients get metadata only through the S12 DTO.

**Delivery channels**
- fax: FaxSender for Sinch, chosen by modeFor('fax'). The fixture completes on the dev clock; a number ending 0000 fails as busy. Retry, then a clinician print-and-mail task.
- mail: a print-ready PDF plus a clinician 'print and mail' task. It never says 'mailed' until the clinician marks it.
- No portal queue and no 'electronic' route for any letter an insurer asked for. The route per payer comes from S6b.

**Member-form claims**
- When the payer lists a member-claim fax, S9's member_form claims can be faxed. A fax confirmation applies the event that moves the claim to submitted.

**Approval rule**
- The engine refuses to send without a recorded clinician approval. A written status inquiry for a stalled claim is a clinician task that needs approval (story 7).

#### Acceptance

- [ ] pdf.test.ts: every page shows the date of service; there is a signature block with credential; the Tax ID appears only in the rendered PDF, never in the stored draft body
- [ ] fax.test.ts (fixture): success; busy → retry → a clinician print-and-mail task
- [ ] mail.test.ts: the mail route creates a print task and never says 'mailed' until someone marks it
- [ ] member-form-fax.test.ts: a member_form claim for a payer with a member-claim fax is faxed and moves ready → submitted on confirmation with one notify
- [ ] raw-dump.test.ts extended: letter bodies are sealed; stored PDFs are ciphertext on disk
- [ ] letters.test.ts: the engine refuses to send any letter without a recorded clinician approval; no letter kind offers an electronic or portal route for a payer request; each sent letter attaches to the claim timeline as metadata

### [ ] N15 — Letters from progress notes, with citations, clinician approval and read-only access (merges S15)

Scheduled: Tue Oct 20 – Wed Oct 21 · Status: new · Size: L · PRD: P0-10.1, P0-10.2, P0-9.1, P0-9.2, R11, R12

Depends on: S14, N9b, S10, N6

Fixture path: The fixture LLM cites the note ids it is given; tasks seeded from fixtures; Sinch fixture.

Founder blockers:

- F4 Q-L3, and whether a typed e-signature is enough
- F5 Bedrock for real drafts
- F8 Sinch
- D2 items 2 and 8

Why: P0-10, story 5 and Goal 5. Legally, letters may draw only on approved progress notes and must never invent anything (Q-L3), so both rules are enforced by tests, not by prompt wording. A lapsed clinician must still be able to answer insurer requests on claims already filed (edge case 16). Clients see only that a letter went out.

#### Scope

**Sources and citations**
- src/core/letters/sources.ts `selectSourceNotes`: approved notes of kind 'progress' for the same client only; the most recent 12, including intake.
- `LetterDraft {kind, paragraphs[{text, cites[{noteId, lineId}]}]}`.
- src/core/letters/citations.ts `validateCitations` checks that:
  - every citation resolves to a supplied note line
  - every clinical paragraph cites at least one line
  - nothing cites outside the source set
  - unknowns stay in [brackets]
- Drafted through llmFor(ctx).generate, with no Tax ID in the input. After one failed redraft, it falls back to the plain bracketed template.

**Triggers**
- `openLetterTask(SystemCtx, {claimId, kind, requestRef})` attaches a draft to a clinician task of kind 'letter', whether S13, S16 or S17 opened it. It is idempotent on requestRef.
- The request type maps to the letter kind (records → records, necessity → necessity, denial → appeal).

**Review and approval** (/app/tasks and /app/letters/[id])
- 'Drafted from N of your notes' with their dates; each citation opens its note line.
- Editable paragraphs; citations are re-validated on every edit, and a clinical paragraph left with no citation is flagged and needs explicit confirmation.
- Approve takes a typed signature and stores the time and a hash of the edited text.
- Access: requireEntitlement plus canWorkOnClaimLetters. Read-only tenants may draft, approve and send for claims filed before the lapse, and are refused for newer claims.

**Sending**
- Goes by the S14 route, and moves the claim info_requested → in_adjudication or denied → appealed through transition().
- A records request sends the cited notes as a PDF.
- The client sees {kind, payerName, sentAt} only.
- Real payer sends are refused unless LETTERS_LIVE is set and `assertLiveLegal(['npi_filing_authorization'])` passes.

#### Acceptance

- [ ] sources.test.ts: a seeded psychotherapy-kind note, an unapproved note and another client's note are never offered to the drafter
- [ ] citations.test.ts: a citation outside the sources, or an uncited clinical paragraph, forces one redraft, then the bracketed template
- [ ] letters.test.ts: nothing sends before approval; approval stores signature, time and a hash of the edited text; the fax fixture receives exactly the approved text
- [ ] letters.test.ts: edited paragraphs persist; an edit that removes every citation from a clinical paragraph is flagged and blocks Approve until confirmed
- [ ] letters.test.ts: each trigger (S13, S16, S17 task) opens exactly one draft, idempotent on requestRef; a necessity request produces a necessity-kind draft
- [ ] letters-readonly.test.ts: a lapsed tenant gets an info_requested task on a claim filed before the lapse and can draft, approve and send it; a letter for a claim filed after the lapse is refused
- [ ] marker.test.ts extended: with a sent records letter and a sent necessity letter each carrying a note marker, no /c page, action or API output contains the marker, and a ClientCtx cannot fetch any letter body, PDF or attachment
- [ ] llm-no-taxid.test.ts extended: letter-draft inputs contain no Tax ID
- [ ] letters.test.ts: each transition fires with one notify effect; opened_at, first_viewed_at and approved_at are recorded
- [ ] letters-live.test.ts: real payer sends are refused unless LETTERS_LIVE is set and the legal texts are final

### [ ] S17 — Denials: plain reasons, routing, and one appeal template covering the top denial reasons

Scheduled: Thu Oct 22 · Status: modified · Size: M · PRD: P0-10.3, P0-10.1, P0-8.4, R11

Depends on: N15, S13

Fixture path: Denial fixtures in fixtures/stedi/277 and EOB shapes.

Founder blockers: none

Why: P0-10.3 asks for one appeal template for the top denial reasons at launch, approved by the clinician. A necessity-only template would leave the common out-of-network behavioral-health denials with no appeal.

#### Scope

**Reasons and routing**
- data/codes/carc-rarc.json turns CARC/RARC codes into plain reasons; the codes sit behind the details tap.
- `classifyDenial` routes each reason in TOP_DENIAL_REASONS:
  - CO-50 medical necessity → appeal
  - CO-197/CO-15 authorization or referral → appeal (no authorization needed for out-of-network outpatient psychotherapy under the plan)
  - CO-242/PR-242 not a network provider → appeal (out-of-network benefit confirmed by the 271 on file)
  - CO-29 timely filing → appeal with proof of timely filing (the 277CA acceptance date)
  - CO-16 missing information and CO-11 diagnosis inconsistent with procedure → clinician code-fix task and corrected claim, not an appeal
  - CO-27 coverage terminated → client task (new insurance)
  - anything else → staff exception

**Appeal template**
- One template, parameterized by reason: a fixed frame plus one reason paragraph, with clinical paragraphs drafted through N15 from progress notes.

**Timing**
- A 180-day appeal countdown via scheduleTimer.
- No win rate shown until there are at least 10 outcomes for that reason and payer.

#### Acceptance

- [ ] classify-denial.test.ts: table over every TOP_DENIAL_REASONS code plus an unknown code
- [ ] appeal-draft.test.ts: for each appealable reason, one task opens with a draft containing that reason's paragraph and citations; approval moves denied → appealed with one notify
- [ ] denials.test.ts: CO-16 and CO-11 open one clinician code-fix task and no appeal; CO-27 opens one client task; 'other' never produces an appeal
- [ ] appeal-window.test.ts: counts down from the denial date and never shows a past date
- [ ] denials.test.ts: no win rate below 10 outcomes

### [ ] S16 — Insurer letters and EOBs scanned by the client

Scheduled: Fri Oct 23 · Status: modified · Size: L · PRD: P0-7.1, P0-10.1, R7, R11

Depends on: S4b, S5, N15, S10

Fixture path: New synthetic EOBs and letters with labels, through the fixture LlmProvider.

Founder blockers:

- F9 de-identified real EOBs and insurer letters
- F6 for real-model accuracy runs

Why: P0-7.1 and story 11. Many insurer requests arrive only by mail, and most payers don't return payment detail in the 277, so EOB scans are the payment signal.

#### Scope

**Extraction**
- InsurerMailExtraction: payerName, letterDate, reference, serviceDates, kind (records_request, necessity_request, denial, payment, eob, other), denialCodes, replyBy, replyFax, replyAddress, plus EOB amounts.
- /c/scan/mail uses the S4b camera. Fields are sealed with sealEphemeral until confirmed, as in S5.

**confirmMail** matches a claim by payer + date of service + client, then:
- an EOB applies one outcome event: paid, partially_paid, applied_to_deductible or denied
- a records_request, necessity_request or denial opens a clinician letter task (N15 drafts it)
- a payee other than the client moves the claim to misdirected with a staff exception (S22 is P1)
- an ambiguous scan opens one client task and never guesses an amount

**Corpus**
- Synthetic EOBs and insurer letters are added to corpus/synthetic by scripts/corpus, with labels.

#### Acceptance

- [ ] mail.test.ts: a scanned records_request opens exactly one clinician task; a necessity_request opens one task whose draft kind is necessity
- [ ] mail.test.ts: a misdirected payee raises a staff exception; each EOB outcome applies the right event exactly once; an ambiguous EOB opens one client task
- [ ] scan-storage.test.ts extended: no photo stored; the external_calls row has no image bytes; nothing saves before confirm; one retake; unconfirmed fields unreadable at +24h
- [ ] corpus:score --kind eob with F6 (describe.skipIf otherwise): amounts ≥ 95% exact on the synthetic EOB corpus; a fixture run doesn't count

### [ ] S18 — Notifications: push, SMS (link only), email, clinician activity list, client home

Scheduled: Sat Oct 24 · Status: modified · Size: L · PRD: P0-9.3, R12

Depends on: S10, S18a, N7a, S12, S7, S21a

Fixture path: Email, SMS and push fixtures write to data/outbox.

Founder blockers:

- F3: Twilio Security/Enterprise BAA plus A2P 10DLC (1–3 weeks; needs the EIN and live privacy and terms pages), or AWS End User Messaging, or an email-only beta
- F5 SES production access

Why: P0-9.3: one notification per state change, and SMS carries a link only. With two audiences, the recipient rule is set here. Once texting is live, phone-only invites need a verified phone.

#### Scope

**Delivery**
- Notify effects go out as web push (VAPID, through S18a's service worker), then SMS, then email (S21a SES).

**Recipients**
- The client gets state changes.
- The clinician gets a message only when a task is assigned to them, once per task, and sees state changes in an activity list at /app/activity.

**Content and channels**
- SMS bodies are a link only, checked by strict assertNoPhi.
- Every email template (state change, task, reminder, invite) goes through the N7a wrapper.
- SmsSender live/test uses Twilio, or AWS End User Messaging under the AWS BAA; SMS may be off at launch.
- STOP/HELP opt-outs are recorded.
- With SMS live, a phone-only invite is accepted only after an SMS code verifies the phone against the contact blind index.

**Client screens**
- iOS users who aren't installed are told push needs Add to Home Screen.
- The client home shows deductible progress from S7.

#### Acceptance

- [ ] notifications.test.ts: the unique key (claim_event_id, recipient) prevents duplicates under retries
- [ ] no-phi.test.ts extended: every SMS and email template (enumerated from src/server/messages) passes; a push payload carries at most a dollar amount
- [ ] channels.test.ts: channel fallback order, including SMS off
- [ ] opt-out.test.ts: STOP is honored
- [ ] activity.test.ts: the clinician activity list shows client state changes without sending a message per change
- [ ] phone-invite.test.ts: with SMS on, a phone-only invite needs a matching SMS code; a mismatched phone is refused
- [ ] home.test.tsx: deductible progress renders from an FX-OON-OK eligibility result and is hidden when unknown
- [ ] ios-hint.test.tsx: the Add to Home Screen hint shows for an iOS user agent not in standalone mode, and not otherwise

### [ ] S28a — Row-level security with owner, app and resolver roles

Scheduled: Sun Oct 25 · Status: modified · Size: M · PRD: P0-11.1, P0-11.2

Depends on: N15, N13, N6, S9

Fixture path: Local Postgres roles and policies.

Founder blockers: none

Why: P0-11: defense below the repos before real data. RLS doesn't apply to table owners unless forced. Resolvers, webhooks, invite acceptance, sweepers and /ops legitimately run without a tenant, so the role design must keep them working. Split from S28.

#### Scope

**Roles**
- ferry_owner runs migrations.
- ferry_app has FORCE ROW LEVEL SECURITY on every tenant table.
- ferry_resolver: SECURITY DEFINER functions, used only by resolvers.ts and repos/ops.ts, returning ids and counts.
- Env: DATABASE_URL_APP and DATABASE_URL_RESOLVER for dev, test and e2e; migrations keep DATABASE_URL.

**Policies**
- user_id = current_setting('app.tenant').
- For CLIENT_SCOPED tables, also client_id = current_setting('app.client_id') when that setting is present.
- Set with SET LOCAL per transaction by the repo layer, from the ctx.

#### Acceptance

- [ ] rls.test.ts: a raw query as ferry_app without app.tenant set returns zero rows from every tenant table; a client-scoped transaction sees only its client_id
- [ ] rls.test.ts: under ferry_app, invite acceptance, the Stripe webhook, /ops metrics, the timer tick and the transcript sweeper still work
- [ ] rls.test.ts: with RLS on, the sweeper erases expired transcripts in two tenants
- [ ] The full vitest and test:e2e suites pass with the app connecting as ferry_app

### [ ] S28b — Hardening: rate limits, cancel export, deletion, staff audit, error copy, relay review

Scheduled: Mon Oct 26 · Status: modified · Size: M · PRD: P0-11.1, P0-2.4, R13

Depends on: S28a, N15, N6

Fixture path: Fixture vendors; local Postgres.

Founder blockers: Question 2: whether trial claims are capped

Why: P0-11, edge case 16 and R13: abuse limits on the costly paths (recorded minutes, LLM calls, invites, trials) and the cancel rules. The limits must not contradict the homepage promises. Split from S28.

#### Scope

**Rate limits**
- Invite sends, scans, LLM generation, eligibility calls, and trial sign-ups per IP.
- Recorded minutes per tenant per day, set well above normal use (at least 10 hours a day) unless D5 changes the copy.
- Claims per trial, if Ryan decides to cap them.

**Cancel, export and deletion**
- Export every approved note as text in a zip for 30 days after cancel.
- Account deletion runs only when canDestroyTenantKey allows.

**Audit**
- An audit log of staff reads through staffActFor.

**Error copy**
- Copy keys for mic denied, dropped connection, gap marked, scan unreadable, consent withdrawn mid-recording, and every mapped 277CA rejection.

**Relay review**
- docs/plans/relay-review.md: a checklist (token, origin, lease, consent kill, dictation cap, no persistence, backpressure), each item tied to a named relay test.

#### Acceptance

- [ ] rate-limits.test.ts: each limit trips with plain copy and makes no vendor call (fixture spy)
- [ ] limits-vs-copy.test.ts: while home-claims lists 'Unlimited notes and dictation', the per-day recorded-minute limit is at least 600 minutes and no note-count limit exists
- [ ] export.test.ts: the zip contains every approved note and nothing else; allowed until day 30 after cancel, refused after
- [ ] delete.test.ts: deletion is refused while any claim is open and succeeds after
- [ ] audit.test.ts: staff reads write audit rows; clinician and client reads don't
- [ ] error-copy.test.ts: every listed copy key exists and passes the banned-vocabulary test
- [ ] relay-review.test.ts: every checklist item in docs/plans/relay-review.md names a relay test that exists
- [ ] e2e/a11y.spec.ts: axe passes on the note editor, capture screens, scan, tracker, letters and homepage

### [ ] N16 — Vendor cutover, launch gating and the real-data preflight (Gate E)

Scheduled: Tue Oct 27 · Status: new · Size: M · PRD: P0-11.2, P0-11.3, P0-11.4, P0-8.1, P0-2.3

Depends on: S21b, S9, S7, N6, N11, S14, S18, S3b, S21a

Fixture path: Suites skip without keys; the preflight and the data-class guard are unit-tested against fixture config and mocked AWS clients.

Founder blockers:

- F1, F2, F3 (if SMS), F5, F6, F7, F8 and every BAA
- F4 final legal texts by Oct 23
- F15 BETA_ALLOWLIST emails and beta clinicians' re-consent to final texts

Why: Everything so far is built against fixtures and mocked SDKs. Before beta, each vendor's test mode must agree with its fixtures. Nothing real may flow until every BAA is signed, every legal text is final, every beta consent is current and training is opted out (P0-11). Prod must stay closed until then, and admit only the beta list until launch.

#### Scope

**Test-mode contract runs** (each suite runs as its key arrives and skips without it)
- Stedi: eligibility mock subscribers; Test Payer claims with 277CA.
- Stripe: test clocks trialing → paused → active → canceled.
- Bedrock: synthetic note and card scoring.
- HealthScribe and Transcribe Medical: on staging, with `say` audio.
- SES: simulator addresses.
- Sinch: a fax number we control.
Real test-mode responses are recorded into fixtures/<vendor>/, and any drift is fixed.

**Preflight** (`bun run preflight:real-data`) prints one pass/fail line for each of:
- the deploy tier is prod and every provider is live, with sms and fax listed if off
- a BAA flag per vendor in config: AWS, Stedi, Sinch, and the SMS vendor if SMS is on
- the AI services opt-out policy is attached (Organizations API)
- Bedrock invocation logging is off
- legal texts are not placeholders
- the LETTERS_LIVE policy
- icons are not placeholders
- every beta clinician (BETA_ALLOWLIST) has identity_verified_at, and current terms, BAA and npi_filing_authorization
- each of their clients has current client_filing and client_recording consents, or none yet
- payer_enrollments status for each beta clinician × payer
- N17 (Gate E2) passed on the current commit
It exits non-zero if anything fails.

**Launch gating**
- FERRY_DATA_CLASS=real is refused while the preflight fails.
- In the prod tier with any other data class, /start, /i/* and POST /api/v1/* refuse.
- Prod moves from prelaunch to the prod tier only after the preflight passes. Sign-up stays on BETA_ALLOWLIST until FERRY_OPEN_SIGNUP=1 on Nov 17.

#### Acceptance

- [ ] Each vendor's contract suite passes in test mode once its key exists (describe.skipIf otherwise)
- [ ] fixtures-schema.test.ts: regenerated fixtures pass their zod schemas
- [ ] preflight.test.ts: against fixture config it exits non-zero with one named line per missing item (including the opt-out policy and a stale beta consent); with everything satisfied (mocked Organizations and Bedrock clients) it exits 0
- [ ] data-class.test.ts: FERRY_DATA_CLASS=real is refused while the preflight fails; in the prod tier with data class synthetic, /start, /i/* and POST /api/v1/* refuse
- [ ] Gate E on Nov 1: preflight:real-data exits 0 on prod, or the beta waits

### [ ] S29 — Ops: PRD metrics including Goal 5, staff exceptions queue, alerts and runbook (merges S21)

Scheduled: Wed Oct 28 · Status: merged · Size: M · PRD: P0-11.1, P0-8.4, P0-10.1

Depends on: S10, N10, N8, S9, N15

Fixture path: demo:seed plus fixture fault injection.

Founder blockers: F5 for the CloudWatch wiring only

Why: The Nov 19 review needs every PRD success metric, including Goal 5 (insurer request to approved letter). Staff-routed work must never stall silently. The erasure and purge alarms already ship in N8 and N12; this adds the rest.

#### Scope

**Metrics** (/ops/metrics, StaffCtx, counts and durations only, built on S9's repos/ops.ts)
- trial → first approved note within 48 h
- median session end → approved note
- approved notes filed the same day
- scans accepted on the first try
- median letter task opened → approved, and first_viewed_at → approved_at (Goal 5)
- trial → paid; paying members
- claims accepted and paid
- recorded minutes per tenant

**Exceptions queue** (/ops/exceptions)
- Open staff tasks by kind and age. Acting on one goes through staffActFor.

**Alerts** (log events with CloudWatch filters once S21b exists)
- Illegal transition attempts (architecture §11).
- Abandoned captures, scribe analytics failures, stuck notes.
- Letters unapproved for more than 3 days.
- Stripe or Stedi webhook failures, an overdue 277CA, stuck jobs.

**Runbook**
- docs/runbook.md gets an entry for each alert, including erasure_lag and purge_overdue.

#### Acceptance

- [ ] metrics.test.ts: numbers match a hand count on demo:seed, including both Goal 5 medians
- [ ] marker.test.ts extended: no PHI in any /ops output
- [ ] ops.test.ts: clinicians and clients get 404 on /ops; staff see ids, kinds and ages only
- [ ] alerts.test.ts: each alert fires in a fixture scenario
- [ ] docs/runbook.md has an entry for every alert (grep against the alert list)
- [ ] After S21b: the CloudWatch filters for every alert exist (infra assertion)

### [ ] N17 — Post-freeze walkthrough (Gate E2): letters, insurer mail, denials, notifications, cancel and export

Scheduled: Thu Oct 29 · Status: new · Size: M · PRD: P0-10.1, P0-10.2, P0-10.3, P0-7.1, P0-9.1, P0-9.3, P0-2.4

Depends on: N15, S16, S17, S18, S28b, S13, N6

Fixture path: All fixture vendors and the dev clock.

Founder blockers: none

Why: The PRD's phasing puts letters (P0-10), insurer mail (P0-7), notifications (P0-9) and deploy and hardening after the Oct 18 freeze. Gate D can't cover them, so they need their own end-to-end proof before the Nov 1 go/no-go.

#### Scope

e2e/gate-e2.spec.ts, on fixtures with the dev clock, clinician at 1280 px and client at 390 px:
1. A fixture 277 necessity request → clinician letter task → edit a paragraph → approve with a typed signature → fax fixture receives exactly the approved text → the client sees the letter as metadata only and gets exactly one notification.
2. The client scans an insurer records-request letter → one clinician task → records letter drafted with citations → approved → sent.
3. A CO-50 denial → appeal draft → approve → appealed.
4. An EOB scan (paid) → the client taps 'It arrived' → Closed.
5. The clinician cancels → clock past period end → read-only → export zip → clock to day 31 → export refused.
6. Across the run:
   - exactly one notification per state change per recipient
   - every SMS body is a link only
   - axe with no WCAG AA violations
   - no third-party origins
   - rawDump (including pgboss) and decryptedDump at +25h contain no transcript, scan-image or typed-note marker

#### Acceptance

- [ ] e2e/gate-e2.spec.ts passes three consecutive runs
- [ ] The notification count per (claim event, recipient) is exactly one across the run
- [ ] After the run, the client-facing marker check finds no note, letter-body or diagnosis marker in any /c page or API output
- [ ] bun run test, typecheck, lint and test:e2e green on main
