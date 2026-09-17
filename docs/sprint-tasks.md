# Sprint tasks — slices with acceptance criteria

Companion to `60-day-sprint.md` (schedule, gates) and `architecture.md` (design). One slice per Claude Code session. A slice is done when every acceptance criterion holds, `bun run test`, `bun run typecheck` and `bun run lint` are green, its box here is ticked, and one local commit is made.

Slice IDs S1–S30 match the numbers in `60-day-sprint.md`. Lettered IDs (S2b, S3b…) are work the original list left unnumbered or implied.

## Blocked on the founder

Ordered by lead time. Nothing here is code. Keys go into `.env.local` by hand; Claude never handles the values.

| # | Item | Lead time | Unblocks |
|---|---|---|---|
| F1 | LLC registered + EIN | days to weeks | F2 production, F5, F7, every BAA |
| F2 | Stedi account → upgrade to pay-as-you-go (MFA + BAA click-through) → **test** API key as `STEDI_API_KEY`; start production enrollment | upgrade is same-day; enrollment is the longest item in the plan | S7, S8 validation, S9 |
| F3 | Twilio account, number, BAA, and **A2P 10DLC brand + campaign registration** (US carriers block unregistered application SMS; approval takes days to weeks and needs the EIN) | 1–3 weeks | S11, S18, S19 |
| F4 | Attorney engaged. First questions: basis for one-tap provider authorization to file under their NPI; e-signature sufficiency; dollar amounts in push bodies (architecture §15) | 1–2 weeks | S11 going live, S3b wording, S30 |
| F5 | AWS: two accounts in an Organization, BAA accepted in AWS Artifact, Bedrock access to `us.anthropic.claude-sonnet-5`, a domain | same-day once started | S21b, S19 inbound mail, any real document |
| F6 | `ANTHROPIC_API_KEY` for synthetic-only extraction runs until Bedrock is ready | minutes | S4, S5, S16 |
| F7 | Stripe account, test keys | same-day | S11b, S20 |
| F8 | Sinch Fax account + BAA (document storage off, 2FA on) | same-day | S14 fax channel |
| F9 | Test corpus: 30+ real superbills and cards, de-identified **before** they touch this machine; 10+ EOBs by Week 2 | slowest input of Weeks 1–3 | S4 gate, S5, S16 |
| F10 | ~~Postgres 17 running locally~~ Done 2026-09-17: 17.11 via Homebrew, started as a login service; `ferry_dev` and `ferry_test` created. Binaries are keg-only at `/opt/homebrew/opt/postgresql@17/bin`. | done | S1 |
| F11 | `tokens.json` and `assets/` logo SVGs exported from the brand work | minutes | S3c logo |
| F12 | ~~Clarify "Stedi's CMS-1500 validator"~~ Resolved 2026-09-17: it means Stedi's claim edits, the validation library run on every submitted claim (HTTP 400 with `errors[]`). Stedi documents no validate-only call. | done | — |

## What changed from the original list

| Change | Why |
|---|---|
| Added S2b, S3b, S3c, S4b, S6b, S11b, S11c, S21b | Encryption split out of S2; consent capture, UI foundation, capture/review screens, payer directory, Stripe card-on-file, landing page and deployment were all code with no slice number |
| Execution order differs from ID order in Week 1 | Auth before the data model (Better Auth owns the user table); state machine before submission (so S9 emits real events); vendor-dependent slices last, because no vendor account exists yet |
| S1 drops the "migration script for existing local data" | There is no local database to migrate |
| Provider links (S11, 15, 19, 22, 24), letters (S14, 17, 22, 23), extraction (S4, 5, 16), timers (S10, 13, 29), validation (S8, 25) each share one primitive | Built once in the first slice listed, reused after (architecture §9) |
| PostHog funnel events replaced by `claim_events` | PostHog needs a paid BAA; S21 and S27 read the same log (D13) |
| S14 fax is Sinch, not Twilio | Twilio fax no longer exists (D12) |
| S11b and S11c move from Week 1 to Week 2 | Neither is on the path to the Day-7 gate |

## Load and slip order

Week 1 is 15 slices, Week 2 is 14, Week 3 is 9. At two sessions a day that is 7.5, 7 and 4.5 days. Week 1 is over capacity by design of the original plan; the numbers above just make it visible.

If a week runs short, slip in this order and keep going: S5 → S6 into Week 2 (run the Day-7 gate with typed card details); then the founder's cut order from the sprint risk table: S27 → S26 → S23 → S24 → S17 beyond one template. Never cut S10, S12 or S20.

## Execution order

**Week 1 (Sep 21–27):** S1 → S3 → S2 → S2b → S10 → S3b → S3c → S6b → S6 → S4 → S5 → S7 → S8 → S9 → S11

**Week 2 (Sep 28–Oct 4):** S4b → S12 → S13 → S14 → S15 → S16 → S17 → S18 → S19 → S11b → S20 → S21 → S21b → S11c

**Week 3 (Oct 5–11):** S22 → S23 → S24 → S25 → S26 → S27 → S28 → S29 → S30

---

## Week 1 — core pipeline in sandbox

### [x] S1 — SQLite → Postgres

Depends on: F10. Plan: `docs/plans/slice-01-postgres.md`.

Produces: `src/server/db/index.ts` exporting `db`, `pool`, `schema`; `src/server/db/schema.ts`; `src/server/db/testing.ts` exporting `resetDb()`; scripts `db:generate`, `db:migrate`; env `DATABASE_URL`, `DATABASE_URL_TEST`.

Scope: engine swap only. Same five tables, same integer ids and epoch-second columns, same behavior. The data model changes in S2.

- [x] `bun run db:migrate` builds the schema on an empty database; running it twice is a no-op
- [x] No `@libsql/client`, no `drizzle-orm/libsql`, no `ready()` anywhere; old SQLite migrations deleted
- [x] A db round-trip test inserts and reads a plan, claim and line item against `ferry_test`
- [x] Manual walkthrough on `bun run dev`: add plan → upload superbill → edit → packet PDF → mark submitted → follow-ups appear
- [x] Existing 7 follow-up tests still pass

### [ ] S3 — Auth: magic link + passkeys

Depends on: S1.

Produces: `src/server/auth/index.ts` exporting `auth`; `requireCtx(): Promise<Ctx>` and `getCtx(): Promise<Ctx | null>` where `Ctx = { userId: string; role: 'patient' | 'provider' | 'staff' }`; route `/api/auth/[...all]`; pages `/sign-in`, `/account`; `src/server/integrations/email` with `send({ to, subject, text, html })` and a `fixture` implementation that writes to `data/outbox/` and logs the link.

- [ ] Better Auth with `magicLink` and `@better-auth/passkey`, Drizzle pg adapter, `nextCookies`
- [ ] Sign in by emailed link; add a passkey on `/account`; sign in with it; sign out; sessions listed and revocable
- [ ] Every existing page requires a session; unauthenticated requests redirect to `/sign-in`
- [ ] Magic links expire in 15 minutes and are single-use; both covered by tests
- [ ] No third-party auth service is called

### [ ] S2 — Multi-user data model, scoped repos, service layer

Depends on: S3.

Produces: `newId(prefix)` returning prefixed ULIDs (`clm_`, `pln_`, `lin_`, `evt_`, `doc_`, `prv_`); all domain tables with `user_id`, string ids, `timestamptz`; new tables `providers`, `provider_links`, `documents`; `claim_lines` replacing `line_items` with `modifiers text[]` (max 4), `units`, `diagnosis_pointers int[]`, `place_of_service`; claims split billing vs. rendering provider; repos in `src/server/db/repos/*` whose every method takes `ctx` first; services in `src/server/services/*`; `/api/v1/claims` (GET list, GET one) as the transport pattern; ESLint `no-restricted-imports` rules from architecture §3; `src/server/log.ts` exporting `log` with allow-list redaction and a per-claim correlation id.

- [ ] A claim with two service lines, 3 units, modifiers `95` + `59`, and per-line diagnosis pointers round-trips through the repo unchanged
- [ ] `log` drops every key not on its allow-list; a test logs a full claim object and asserts no name, member ID, diagnosis, Tax ID or address reaches the output
- [ ] Tenant isolation test: user B gets `null`/empty for every repo read of user A's rows and cannot update or delete them
- [ ] No file under `src/app` or `src/ui` imports `drizzle-orm` or `@/server/db`; lint fails if one does
- [ ] Server actions are thin: parse input, call one service, revalidate/redirect
- [ ] `/api/v1/claims` returns only the caller's claims, zod-validated, errors as `{ code, message }`
- [ ] The walkthrough from S1 still works for two different signed-in users without seeing each other's data

### [ ] S2b — Envelope encryption

Depends on: S2.

Produces: `KeyProvider { wrap(plain: Buffer): Promise<WrappedKey>; unwrap(w: WrappedKey): Promise<Buffer> }` with `local` and `aws-kms` implementations; `getUserKey(ctx): Promise<Buffer>`; `seal(key, plaintext): string`; `open(key, sealed): string`; `blindIndex(value): string`; table `user_keys`; `Storage { put(ctx, kind, bytes): Promise<{ key: string; sha256: string }>; get(ctx, key): Promise<Buffer> }` with `local` and `s3` implementations that encrypt with the user's key.

- [ ] Sealed format `v1.<keyId>.<iv>.<ciphertext>.<tag>`, AES-256-GCM, fresh IV per value; tamper test fails to open
- [ ] Columns sealed per architecture §6; a raw SQL dump of a populated test database contains none of the seeded names, member IDs, diagnosis codes or Tax IDs
- [ ] Blind index finds a plan by member ID without decrypting any row
- [ ] Uploaded files on disk are ciphertext; deleting a user's `user_keys` row makes their fields and files unreadable (test)
- [ ] `aws-kms` provider is covered by a contract test with a mocked KMS client; `local` refuses to start when `NODE_ENV=production`
- [ ] Tax ID renders masked to the last four everywhere in the UI

### [ ] S10 — State machine, event log, job queue, timers

Depends on: S2b. Reuses and then deletes `src/lib/followups.ts`.

Produces, in `src/core/claim/`: `states.ts` (`CLAIM_STATES`, `StateDef`), `events.ts` (`ClaimEvent` union), `effects.ts` (`Effect` union), `transition.ts` (`transition(claim: ClaimSnapshot, event: ClaimEvent, rules: PayerRules): TransitionResult`), `timers.ts`, `experience.ts` (`chipFor(state, hasOpenTask, outcome)`, `segmentsFor(state)`). In `src/server/`: `services/claim-engine.ts` exporting `applyEvent(actor, claimId, event)`; `jobs/queue.ts` (pg-boss); `jobs/handlers/*`; `worker.ts`; tables `claim_events`, `patient_tasks`, `notifications`.

- [ ] All 16 states and every transition in architecture §4 are tested; every pair not in the table returns `IllegalTransition` (generated test over the full state × event matrix)
- [ ] `applyEvent` writes the `claim_events` row, the new `claims.state` and the effects in one transaction; a forced failure after the event insert leaves no trace (test)
- [ ] Timers for `submitted`, `accepted`, `in_adjudication` are scheduled from `PayerRules` with MVP defaults as fallback; entering a new state cancels timers that no longer apply
- [ ] Exactly one `notify` effect per applied transition (property test over random legal event sequences)
- [ ] `bun run worker` starts, picks up a due timer in a test, and applies the resulting event
- [ ] Old `follow_ups` table and engine are gone; existing pages render the new states

### [ ] S3b — Consent and authorization records

Depends on: S3.

Produces: table `consents`; `recordConsent(ctx, { docType, version, typedName, ip, userAgent })`; `hasConsent(ctx, docType)`; versioned texts in `content/legal/*.md` (placeholder drafts until S30); consent screen.

- [ ] Consent screen lists each field sent to the insurer with a one-line reason (name, DOB, member ID, diagnosis, procedure codes, dates, charges)
- [ ] Stored record carries the document's content hash, so a later edit of the text never rewrites what was agreed to
- [ ] Eligibility (S7) and submit (S9) services refuse without a current `patient_authorization` consent (test)
- [ ] Copy follows the brand voice: one ask, why, what happens next

### [ ] S3c — UI foundation

Depends on: none beyond S1. F11 for the logo.

Produces: Tailwind 4 `@theme` tokens in `globals.css`; fonts via `next/font/google`; `src/ui/`: `Button` (primary, secondary, tertiary), `Card`, `Chip`, `Input`, `ProgressBar`, `TimelineRow`, `BottomNav`, `Screen`; `src/core/brand.ts` holding the product name; dev-only gallery at `/dev/ui`.

- [ ] Every token in `FERRY_BRAND.md` §3–§5 exists under the same name; no hex values outside the theme file (lint or grep test)
- [ ] All seven chips from `FERRY_BRAND.md` §12.2 render with the specified fill and text
- [ ] Gallery renders correctly at 390 px wide and at 130% text scale; reduced-motion disables the wave
- [ ] Icon-only buttons have `aria-label`; all controls are real `<button>`/`<a>`/`<input>`
- [ ] No shadows, gradients, dividers, or second primary button on any gallery screen

### [ ] S6b — Payer directory

Depends on: S2.

Produces: `data/payers/*.json` validated by a zod schema; tables `payers`, `payer_rules`; `bun run payers:load`; `getPayer(payerId)`, `findPayerByName(name)`, `getPayerRules(payerId): PayerRules` with defaults.

- [ ] Top 15 payers from the sprint seeded: Stedi payer ID, claims and appeals addresses, timely-filing days, 837P/270/276 `transactionSupport`, paper-check flag, state DOI contact
- [ ] Every field carries `verified: true | false`; unverified fields render with a caveat wherever shown
- [ ] Loader is idempotent and versioned: changing a file creates a new `payer_rules` version and never mutates an old one
- [ ] `findPayerByName` resolves common card variants ("UHC", "United Healthcare", "UnitedHealthcare Oxford") — table-driven test

### [ ] S6 — NPPES lookup

Depends on: S2.

Produces: `nppes.lookup(npi): Promise<NppesProvider | null>` with `live` and `fixture` implementations; `providers` cache with a 30-day TTL. Consumes `isValidNpi(npi)` from `src/core/npi.ts`, which already exists (built with the corpus).

- [ ] Invalid check digit is rejected before any network call
- [ ] Lookup fills name, credential, taxonomy, practice address and phone; NPI-1 vs NPI-2 recorded
- [ ] A second lookup inside the TTL makes no network call (test)
- [ ] NPPES outage degrades to "we'll confirm the provider later", never blocks a draft

### [ ] S4 — Superbill extraction and scoring harness

Depends on: S2b, F6 or F5. Corpus: `corpus/synthetic/` now, `corpus/real/` as F9 arrives.

Produces: `LlmProvider { extract<T>(input: { document: Buffer; mime: string; schema: ZodType<T>; prompt: string }): Promise<T> }` with `bedrock`, `anthropic` and `fixture` implementations; `SuperbillExtraction` v2 in `src/core/extraction/superbill.ts` (billing provider, rendering provider, patient, diagnosis codes, lines with up to 4 modifiers, units, diagnosis pointers, POS); `bun run corpus:score --kind superbill`.

- [ ] Schema-constrained output; no brace-matching parser
- [ ] `anthropic` provider throws unless `FERRY_DATA_CLASS=synthetic`, and always when `NODE_ENV=production` (test)
- [ ] Scorer prints per-field accuracy and writes `corpus/results/<timestamp>.json`; exits non-zero if NPI, date of service, CPT, ICD or charge is under 95%
- [ ] Gate fields reach ≥ 95% on the synthetic corpus; each miss is listed with document id and expected vs. actual
- [ ] Low-confidence or missing required fields are flagged per field so the review step can ask for exactly those
- [ ] A provider-completed CMS-1500 form is accepted as an input document, not only superbills: diagnoses from box 21, service lines from 24A–J, Tax ID from 25, providers and NPIs from 31–33. Add corpus case `sb-11` (a filled CMS-1500, photographed) to `scripts/corpus/data.ts` in this slice. If box 27 shows Accept Assignment = Yes or box 13 is signed, flag it: we file non-assigned

### [ ] S5 — Insurance card extraction

Depends on: S4, S6b.

Produces: `InsuranceCardExtraction` (payer name, member ID, group number, plan type, claims address and payer phone from the back); `createPlanFromCard(ctx, front, back?)`; scorer kind `card`.

- [ ] Front and back photos create or update a plan with the payer resolved through `findPayerByName`
- [ ] Unresolved payer opens one patient task, never a free-text payer on a claim
- [ ] Member ID ≥ 95% exact-match on the synthetic cards
- [ ] HMO, Medicaid and Original Medicare cards are recognized and gated with a plain explanation

### [ ] S7 — Eligibility (270/271) and the result screen

Depends on: S3b, S5, S6b; F2 for `test` mode.

Produces: `stedi.eligibility(req): Promise<Eligibility271>` (`live`, `test`, `fixture`); in core, `summarizeBenefits(r): BenefitsSummary` and `estimateReimbursement(input): { lowCents: number; highCents: number; basis: string }`; result screen.

- [ ] Results render for at least 5 payers using Stedi's predefined mock subscribers; each response is recorded as a fixture. Put those subscriber values into `scripts/corpus/data.ts` and regenerate the cards, so a card photo drives the mock 271 end to end
- [ ] Screen states, in brand voice: out-of-network benefits or not, deductible and amount left, share paid after that, an estimate as a range with its basis, the payer's typical days when known
- [ ] No out-of-network benefit → the patient is told before anything is filed, and no claim can reach `ready`
- [ ] Requires a verified email and consent; calls are counted per user for S28 rate limits
- [ ] Payer down or unsupported degrades to "we'll check your benefits when we file", never blocks the draft

### [ ] S8 — 837P builder and validation

Depends on: S6, S6b, S10; F2 for the Stedi check.

Produces: `buildProfessionalClaim(claim: ClaimRecord, party: { submitter: Submitter; payer: PayerRef }): Stedi837PRequest` in `src/core/x12/`; `validate(claim: ClaimRecord, rules: PayerRules): Issue[]` in `src/core/validation/`.

- [ ] Every built claim has `planParticipationCode: 'C'` (CLM07) and `benefitsAssignmentCertificationIndicator: 'N'` (CLM08); a property test asserts this over the whole corpus and over generated claims
- [ ] Billing vs. rendering provider, patient vs. subscriber (dependents), multiple lines, units, up to 4 modifiers and diagnosis pointers all map correctly (snapshot per corpus document)
- [ ] `validate` blocks `draft → ready` on any error-level issue and names the single field to fix
- [ ] Every corpus claim, submitted in Stedi test mode, comes back with no claim-edit errors (Stedi returns HTTP 400 with `errors[]` of `code`, `description`, `followupAction` when an edit fails). Stedi has no validate-only call, so without a key the check is a zod schema of the request shape
- [ ] A failed Stedi edit maps to an `Issue` with the same shape `validate` produces, so the patient sees one fix, not a vendor error
- [ ] No claim can be built for a gated plan type

### [ ] S9 — Submission and 277CA ingestion

Depends on: S8; F2.

Produces: `submitClaim` effect handler; `stedi.submitProfessionalClaim(req)`; 277CA poller; `map277CA(report): ClaimEvent` in `src/core/x12/`; table `external_calls`; rejection reason table with plain copy and a fix class (`auto`, `patient`, `staff`).

- [ ] A synthetic claim submitted to payer `STEDI` with `usageIndicator: 'T'` reaches `accepted` from a photo with no manual step
- [ ] Rejected 277CA fixtures drive `rejected_front_end`; an `auto` reason is corrected and resent, a `patient` reason opens one task, a `staff` reason raises an exception event
- [ ] Submission is idempotent: a retried job never sends a second claim (test on idempotency key)
- [ ] Request and response are stored sealed in `external_calls`
- [ ] Cancel works until `accepted`, then is refused with plain copy
- [ ] Stedi's generated CMS-1500 PDF for each submitted claim is fetched and attached to the timeline as the record of what we sent

### [ ] S11 — Provider action link, SMS, channel selection

Depends on: S10; F3 for live SMS; F4 before real providers.

Produces: table `action_links`; `createActionLink({ purpose, providerId, claimId?, ttl }): Promise<string>` with purposes `authorize_filing | records_request | confirm_session | confirm_refund | claim_account`; page `/p/[token]`; `sms.send(to, body)` with `assertNoPhi(body)`; `selectChannel(claim, provider, payer): 'electronic' | 'member_form'`; `src/server/documents/packet.ts` (moved from the MVP).

- [ ] Tokens are 32 random bytes, stored hashed, single-purpose, expiring, and audited on use
- [ ] The authorization page shows the provider's name and NPI and the patient's first name only; one tap records the authorization with timestamp, IP and document hash
- [ ] `assertNoPhi` rejects bodies containing a name, payer, code, date of service or amount from the claim (test); the SMS is a generic prompt plus link
- [ ] `electronic` only when the provider has authorized and the payer's 837P is `SUPPORTED`; otherwise the packet path, same state machine
- [ ] Without F3, SMS runs in `fixture` mode and the link is shown to the patient to share

**Week 1 gate (Day 7):** sandbox claim `accepted` end to end from a photo; extraction ≥ 95% on the corpus; eligibility for 5 payers in sandbox; all Week 1 slices committed with tests.

---

## Week 2 — the loop

### [ ] S4b — Capture and review screens

Depends on: S3c, S4.

- [ ] Camera screen per brand §6: navy surface, corner brackets, "Lay it flat."; falls back to the system camera input; "Upload a PDF" alternative
- [ ] A blurry capture is caught on the device and answered with "That one's a little blurry. One more try?"
- [ ] Review screen "Here's what we saw." shows provider, what it was for, visit date, you paid; tap to edit; only flagged fields ask for attention
- [ ] Works signed out as an anonymous draft that expires in 24 h with its files deleted; the draft is claimed on sign-up
- [ ] Photo to review in under 10 s p50 in fixture mode; a complete extraction needs zero typing

### [ ] S12 — Timeline UI

Depends on: S4b, S10.

Produces: home, trips list, trip detail; `src/core/claim/copy.ts` with copy for all 16 states; `bun run demo:seed`; Playwright walkthrough.

- [ ] Lists show chip, three segments and one line of state copy; detail shows every past state as a timeline row and every letter sent; codes and math only behind the details tap
- [ ] A test scans all non-details copy for the banned vocabulary in `FERRY_BRAND.md` §2 and fails on a hit
- [ ] `demo:seed` creates one claim in each of the 16 states; every one renders
- [ ] Playwright: photo → review → send → `accepted` in fixture mode, at 390 px, passes
- [ ] Meets WCAG AA contrast and keyboard/VoiceOver navigation on the three screens

### [ ] S13 — 276/277 polling and ETA

Depends on: S10. Stedi has no test mode for claim status: fixture-only until real claims exist.

Produces: `pollStatus` effect handler; `mapStatusResponse(r): ClaimEvent | null` in `src/core/x12/`; `etaFor(claim, rules, now)`; `bun run fixtures:replay`.

- [ ] Cadence comes from `payer_rules` (default 7 days) and only runs for claims the payer accepted at least 7 days ago
- [ ] Fixtures exist for every outcome the mapper can produce: pending, info requested, paid, partial, deductible, denied, not found
- [ ] An unchanged status produces no event and no notification
- [ ] ETA on the detail screen moves with each poll and never shows a date in the past

### [ ] S14 — Letter engine and the stalled inquiry

Depends on: S10; F8 for live fax.

Produces: template registry in `src/core/letters/`; `generateLetter` effect handler; `letters` table; PDF render; delivery channels `fax`, `portal_queue`, `mail`.

- [ ] `stalled` generates a status-inquiry letter addressed from the payer directory and attaches it to the timeline
- [ ] Channel comes from the payer directory; `portal_queue` opens a staff task with the text ready to paste
- [ ] LLM polish runs only through Bedrock; without it the template is sent as written; nothing is invented, unknowns stay in brackets
- [ ] Fax delivery status is tracked to completion; a failed fax retries, then falls back to `portal_queue`

### [ ] S15 — Records requests

Depends on: S11, S14.

- [ ] `info_requested` sends the provider an action link (`records_request`) to an upload page with the payer's checklist (name, DOB or member ID, date of service on every page, start and stop times, signature with credentials)
- [ ] Provider nudged at 10 days, patient at 20, per framework §3.4
- [ ] Upload returns the claim to `in_adjudication` and the letter engine sends the records
- [ ] Patient sees "nothing for you to do" until day 20

### [ ] S16 — EOB upload and parsing

Depends on: S4; F9 for real EOBs.

Produces: `EobExtraction` schema (payer, reference, per-line billed, allowed, deductible, coinsurance, paid; payee; check or EFT number and date; denial codes); `mapEobToEvent(eob): ClaimEvent`; scorer kind `eob`.

- [ ] A parsed EOB moves the claim to `paid`, `partially_paid`, `applied_to_deductible` or `denied` with amounts
- [ ] Payee other than the patient raises `misdirection_detected`
- [ ] Amounts ≥ 95% exact on the EOB corpus (10+ real, de-identified, plus synthetic)
- [ ] An ambiguous EOB opens one patient task; it never guesses an amount

### [ ] S17 — Denials and appeals

Depends on: S14, S16.

Produces: `data/codes/carc-rarc.json`; `classifyDenial(codes): 'medical_necessity' | 'timely_filing' | 'non_covered_or_coding' | 'other'`; three appeal templates.

- [ ] Denial detail shows the plain reason in the timeline, the code only behind the details tap
- [ ] One tap approves the drafted appeal; the 180-day window counts down
- [ ] No win-rate is shown until we have at least 10 outcomes for that reason and payer
- [ ] `other` goes to a staff exception, not to a generic appeal

### [ ] S18 — Notifications, PWA shell, deductible progress

Depends on: S10, S12; F3 for SMS.

- [ ] One notification per state change, enforced by a unique key on the `claim_events` id; channel order push → SMS → email with per-user preference
- [ ] Bodies follow `FERRY_BRAND.md` §12.4; a test rejects any SMS body that fails `assertNoPhi`
- [ ] Web app manifest, service worker, install prompt; web push with VAPID; iOS users are told push needs Add to Home Screen
- [ ] Home shows deductible progress and "sessions until it's met" from eligibility plus parsed outcomes

### [ ] S19 — Autopilot: email inbox and provider "YES"

Depends on: S4, S11; F5 for SES inbound, F3 for SMS.

- [ ] Each user gets `u_<token>@claims.<domain>`; a forwarded superbill PDF becomes a draft claim; `bun run inbound:simulate <file.eml>` does the same locally
- [ ] Mail with no readable attachment gets a friendly bounce, not a broken draft
- [ ] Provider SMS replies `YES`, `YES 2`, `NO`, `SKIP` create or skip claims from that patient's learned defaults
- [ ] Two sources for the same patient, provider and date confirm one claim; they never create two

### [ ] S11b — Stripe card on file

Depends on: S3; F7.

- [ ] Customer created at sign-up; card saved with a SetupIntent and the Payment Element; the pay-when-paid promise sits above the field
- [ ] Stripe metadata and descriptions carry only opaque ids (allow-list test)
- [ ] Card removal and replacement work from `/account`

### [ ] S20 — Fee events

Depends on: S10, S11b.

Produces: `computeFee(input: { recoveredCents: number; isFirstPaidClaim: boolean; autopilot: boolean; config: FeeConfig }): { feeCents: number; capApplied: boolean; reason: string }` in `src/core/fees/`; `chargeFee` effect handler; table `fee_events`.

- [ ] Fee = min(flat fee, 10% of recovered); first paid claim free; Autopilot subscribers pay no per-claim fee; `applied_to_deductible` and `denied` always $0 (table-driven tests)
- [ ] Fires only with the patient as payee; a later `misdirection_detected` reverses it automatically and it fires again on refund confirmation
- [ ] Idempotent per claim; a retried job never charges twice
- [ ] Autopilot subscription pauses in a month with no paid claim
- [ ] A simulated `paid` charges a test card end to end (Week 2 gate)

### [ ] S21 — Funnel dashboard

Depends on: S10.

- [ ] Staff-only `/ops/funnel` reads `claim_events`: photo → extracted → eligibility → ready → submitted → accepted, by week, with median photo → `ready`
- [ ] Shows counts and durations only, no PHI
- [ ] Numbers match a hand count on the demo seed

### [ ] S21b — Staging and production deploy

Depends on: F5.

- [ ] Infrastructure as code: ECS Fargate (web, worker), RDS Postgres with PITR, S3, KMS, SES, secrets in AWS; staging and prod in separate accounts
- [ ] CI runs test, typecheck, lint and deploys staging on merge; prod deploy is a manual approval
- [ ] `KeyProvider` is `aws-kms`, `Storage` is `s3`, LLM is `bedrock` in both environments; the app refuses to boot in production with any `local` or `fixture` provider
- [ ] Health checks, log redaction verified on a sample request, restore from snapshot rehearsed once

### [ ] S11c — Landing page and waitlist

Depends on: S3c.

- [ ] One action, "Snap a superbill", leading into S4b's anonymous capture; waitlist email capture
- [ ] PostHog on public pages only, cookieless, never loaded inside the signed-in app
- [ ] Copy from the brand copy bank; Lighthouse performance and accessibility ≥ 90 on mobile

**Week 2 gate (Day 14):** all 16 states reachable in the demo; a forwarded email becomes a draft claim; a fee fires on a simulated `paid`; a real claim in Stedi production if enrollment has cleared.

---

## Week 3 — everything else, and hardening

### [ ] S22 — Misdirected payment

Depends on: S11, S14, S16, S20.

- [ ] `misdirection_detected` → `misdirected`; refund-to-patient letter sent to the provider with a `confirm_refund` link; nudges at 14 and 30 days
- [ ] Provider confirmation returns the claim to `paid`; the fee follows the rule in S20

### [ ] S23 — Escalation and regulator complaints

Depends on: S14.

- [ ] Complaint generator for NY, CA, MA, CO, IL, TX from `data/regulators/*.json`
- [ ] Self-funded employer plans route to the U.S. Department of Labor (EBSA), not the state regulator; plan funding type comes from eligibility or one patient question
- [ ] The complaint attaches our dated inquiry log from `claim_events`; the patient approves it with one tap

### [ ] S24 — Provider light account

Depends on: S6, S11.

- [ ] A provider claims an account from an action link; NPPES prefill; licenses by state; per-patient defaults learned from past superbills
- [ ] "Invite my provider" on the patient home sends the link
- [ ] The provider sees only what is waiting on them; no patient diagnosis beyond what they themselves billed

### [ ] S25 — Payer scrubber rules

Depends on: S8, S6b.

- [ ] Rules live in `payer_rules`: telehealth (modifier 95 or GT, POS 02/10), taxonomy, timely filing
- [ ] Testing codes: 96130/96131 and 96136/96137 unit logic; add-on codes require their primary (90833/90836/90838 with an E/M; 90785 with psychotherapy)
- [ ] Each rule has a passing and a failing corpus example

### [ ] S26 — Non-par registration packets

Depends on: S14, S24.

- [ ] A registration is a tracked object with its own states and ETA, pre-warned at eligibility time
- [ ] E-signed W-9 and license upload produce the payer's packet as a PDF

### [ ] S27 — Public scorecard

Depends on: S21.

- [ ] `/scorecard`: days to accepted, days to paid, denial rate, by payer, from `claim_events`; sample size shown
- [ ] Payers with n < 10 are not shown; aggregates refresh on a job; no PHI

### [ ] S28 — Hardening

- [ ] Rate limits and abuse controls on eligibility and anonymous capture
- [ ] Error copy for every failed extraction and every mapped 277CA rejection, in brand voice
- [ ] Audit log of staff PHI reads; account deletion by key destruction; data export
- [ ] Postgres row-level security on PHI tables as a second layer under the repos
- [ ] Accessibility pass on capture, review, list and detail

### [ ] S29 — Ops

- [ ] Alerts: overdue timers, failed Stedi calls, illegal transitions, stuck jobs
- [ ] Backup and restore drill completed and written up
- [ ] Photo → `ready` under 90 s p50, measured from `claim_events`
- [ ] `docs/runbook.md` for every alert

### [ ] S30 — Pricing and legal pages

Depends on: F4.

- [ ] Pricing page reads the fee config; one definition of the guarantee, one page
- [ ] Privacy, terms and both authorizations come from versioned files; `consents` reference their hashes; a text change prompts re-consent

**Week 3 gate (Day 21):** code-complete; zero open slices; a stranger-style walkthrough on the production stack with a test payer completes unassisted; runbook written.
