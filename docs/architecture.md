# Ferry — Phase 1 architecture (2026-09-17, revised 2026-09-27)

The validated design for the 60-day sprint. The product is the clinician membership in `prd.md` and `spec.html` (2026-09-27); `mentaya-teardown-and-product-framework.md` holds the original market framing and the §3.4 state table. Slices, gates and dates live in `sprint-tasks.md`, the calendar and metrics in `60-day-sprint.md`, voice and UI in `FERRY_BRAND.md`. Where those documents disagree with this one on a technical point, this one wins and the decisions table says why.

The 2026-09-27 revision replaces the patient-first model: the clinician is the paying member and the tenant, clients never pay, claims file from approved notes, and audio goes phone → capture relay → AWS HealthScribe. The per-claim fee, the email inbox and the provider action links are gone.

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | The product is a clinician membership: a 7-day trial with no card, then one monthly price held in `PRICING` (`src/core/billing`). Clinicians use the responsive Next.js web app on desktop and phone; clients use the same app installed on their phone (manifest, service worker, mic and camera in the browser). Expo store apps are P1 on the same `/api/v1`. | Ryan, 2026-09-27 (`prd.md`). D4 in the PRD: store review for a health app that records audio can take weeks, and the installable web app gets mic and camera without it. One codebase inside the build window. Supersedes the 2026-09-17 patient PWA. |
| D2 | Modular monolith: one repo, one package, three processes (web, worker, capture relay), one Postgres. | Year-3 base case is ~2,000 claims/day. Throughput is not the constraint; correctness per payer, support cost per claim, auditability and adding clients are. The relay exists because browsers can't hold HealthScribe's signed HTTP/2 stream and Next route handlers can't hold WebSockets. |
| D3 | `src/core` is pure TypeScript with no I/O, enforced by lint. Promoted to `packages/core` when a second consumer (Expo) exists. | Keeps the state machine, entitlements, code rules and 837P mapping testable and portable without paying monorepo overhead now. |
| D4 | The state machine has 16 states (the §3.4 table), not 14. | The table is the source of truth; the prose count was wrong. |
| D5 | Tracker is layered: brand chips and the three-segment bar on lists; every state visible on trip detail in Ferry voice; codes, reference numbers and reimbursement math behind a details tap. | Keeps the glass-box differentiator (framework M3) without breaking the brand voice. |
| D6 | Copy never asserts something Ferry cannot observe. `paid` means the payer issued payment, shown as "On its way." The "It landed" push and celebration fire only when the client confirms arrival. A claim closed without confirmation states what the payer reported ("Cigna sent $126 on Sep 14"). A member-form claim is not "sent" until the clinician marks it mailed or a fax confirms. | Ferry never touches the money; most non-assigned claims pay by mailed check. |
| D7 | Definition of done applies as written to payers whose 837P is `SUPPORTED` in Stedi and whose enrollment for the clinician's NPI is active. Otherwise the claim goes by member form: it waits in `ready` with one clinician print-and-mail task (or a Ferry fax), and the enrollment is tracked (S6b, S9). | Stedi enrollment is per clinician NPI per payer and takes 24–48 h, up to 30 days. |
| D8 | AWS is the PHI stack: RDS Postgres, S3, KMS, DynamoDB (ephemeral keys), Bedrock, SES, ECS Fargate, AWS HealthScribe for recorded sessions and Amazon Transcribe Medical for dictation (2026-09-27), all in us-east-1 because HealthScribe runs only there. | One free self-serve BAA (AWS Artifact) covers database, storage, keys, LLM, speech, email and compute. Supabase HIPAA is ~$950+/mo against a $200–500 budget line; App Runner is closed to new customers. |
| D9 | Auth is Better Auth (magic link + passkey plugins, Drizzle pg adapter) in our own database. | No auth vendor, no extra BAA, vendor-neutral. |
| D10 | Jobs run on pg-boss with id-only payloads. Timers are rows in a `timers` table (UNIQUE(subject, kind)) fired by a tick job every minute that reads `dueTimers(clock.now())`; pg-boss delayed jobs (`startAfter`) are never used for timers. Server code reads time only from `clock.now()`, which adds a dev-tier offset row. | pg-boss compares `startAfter` with Postgres `now()`, so a fake clock can't drive delayed jobs. A table plus one shared dev clock lets Next, the worker, the relay and CLI scripts agree on time, which every timer and erasure criterion needs (2026-09-27). No new vendor, no new BAA. |
| D11 | No 835 ingestion in Phase 1. Adjudication signals are 276/277 and EOB scans. | ERA enrollment is exclusive per provider per payer; enrolling a clinician through us would take their existing feed. |
| D12 | E-fax is Sinch Fax API, not Twilio. | Twilio Programmable Fax was shut down in December 2021. Sinch signs a free self-serve BAA. |
| D13 | Product metrics come from our own `claim_events` log and table timestamps (S29). No analytics or third-party script on any page at launch. | PostHog's BAA requires a $250/mo package; the homepage tests forbid third-party origins (S11c). |
| D14 | "Ferry" is a working name held in one constant. The domain word in code is `claim`; "trip" is client UI copy only. A therapy session is an `encounter` in code (Better Auth owns `sessions`). | Name decision is open; `sessions` is taken. |
| D15 | One branch and one commit per slice; when test, typecheck and lint pass (plus `test:e2e` when the slice has e2e acceptance), fast-forward `main` and delete the branch without asking. Never push, force or rewrite history without asking. | Agreed 2026-09-17. Solo engineer, strict per-slice checks; pull requests start when there is a second reviewer or SOC 2 evidence collection begins. |
| D16 | `FERRY_DEPLOY_TIER` (`dev \| prelaunch \| staging \| prod`) is separate from `NODE_ENV` and decides which integration modes may boot; every process calls `bootProcess()` first. | Production builds run in every tier. Prod serves only public pages (prelaunch) until Gate E, then admits only the beta allow-list until open sign-up (2026-09-27). |
| D17 | Transcripts, dictation text, typed rough notes and unconfirmed scan fields are sealed under per-record keys kept outside Postgres and erased at 24 hours by destroying the key. | Ryan, 2026-09-27. RDS backups then hold only ciphertext whose key no longer exists. |

## 2. System shape

```
browsers: clinician (desktop, phone), client (installed web app), public pages
        │ HTTPS                              │ WebSocket, 16 kHz PCM
        ▼                                    ▼
  web process ── Next.js 16             relay process (ws) ──► HealthScribe (record)
  UI, /api/v1, /api/webhooks                 │                 Transcribe Medical (dictation)
        │                                    │
        ├── services ──► core (pure rules)   │
        │       │                            │
        │       ▼                            ▼
        │   Postgres ◄── worker process (pg-boss): timer tick, erasure sweeper,
        │       ▲          notes, imports, submission, polling, notifications, letters
        │       │
        └── integrations: Stedi · NPPES · LLM (Bedrock) · scribe · SMS · fax (Sinch)
                          · email (SES) · billing (Stripe) · storage (S3) · keys (KMS, DynamoDB)
```

Three processes from the same codebase: web (Next), worker (`bun run worker`) and relay (`bun run relay`). Each imports the same services and integrations and calls `bootProcess()` before anything else. The relay never writes audio anywhere. It holds transcript segments only in memory and writes them only through `importDictation(systemCtx, captureId)` (a direct service call that seals the text with `sealEphemeral`) or the `importScribeResult` job (which reads HealthScribe's S3 output by capture id). No transcript text ever goes into a job payload.

## 3. Code layout and boundaries

```
src/core/        pure domain, no I/O
  claim/         states, events, effects, transition(), timers, filing-gate, from-note, chips, copy
  billing/       PRICING, entitlementsFor(), trial reminder times
  notes/         note model and formats
  codes/         psychotherapy time/add-on/intake rules, ICD-10 billable check
  capture/       PCM frames, relay protocol, gaps, limits
  scribe/        HealthScribe output schemas
  scan/          frameVerdict
  x12/           claim record → 837P JSON mapping; 277CA/277 → domain events
  validation/    validate(claim, payerRules) → Issue[]
  letters/       source selection, citations, appeal template
  messaging/     assertNoPhi
  api/           strict DTOs (clinician claims, client trips)
  legal.ts, money.ts, mask.ts, npi.ts
src/server/
  auth/          ctx.ts (contexts), requireClinician/Client/Staff
  db/            drizzle pg schema, migrations, columns.ts, repos (tenantWhere, resolvers.ts, ops.ts)
  crypto/        KeyProvider (local | aws-kms), EphemeralKeyStore (local | dynamodb), seal, blind index
  storage/       Storage (local encrypted | s3), sent letter PDFs only (S14)
  jobs/          queue (id-only payloads), tick, handlers
  relay/         capture relay (ws)
  integrations/  mode.ts (modeFor) · clearinghouse/ nppes/ llm/ scribe/ sms/ fax/ email/ billing/
  services/      use cases: the only code that writes
  documents/     member-form packet, letter PDF
  clock.ts, deploy.ts, boot.ts, log.ts
src/app/         (public) · app/ (clinician) · c/ (client) · ops/ (staff) · i/[token] · dev/ (dev tier) · api/v1 · api/webhooks
src/ui/          components built from brand tokens; capture and scan camera
src/pwa/         service worker source
worker.ts
infra/           CDK stacks (S21a)
content/legal/   versioned legal texts with front matter
corpus/          synthetic/ (cards, sessions, EOBs, letters; in git) · real/ (gitignored, de-identified only)
fixtures/        recorded vendor responses (271, 277CA, 277, NPPES, Stedi OpenAPI)
data/payers/     payer directory and rules as JSON, loaded into tables
data/codes/      ICD-10-CM and CARC/RARC tables
```

Lint-enforced rules (`no-restricted-imports` plus `src/boundaries.test.ts`):

- `src/core/**` may import only `zod`, `date-fns` and other `src/core` modules.
- `src/app/**` and `src/ui/**` may not import `drizzle-orm` or `@/server/db/**`. Reads and writes go through `@/server/services`.
- Only `src/server/db/repos/**` sees ciphertext.
- `systemCtx()` only from `src/server/jobs/**`, `src/server/relay/**`, `src/app/api/webhooks/**` and `src/server/services/ops.ts`; `inviteCtx()` only from `src/server/services/invites.ts`.
- `@anthropic-ai/*` only under `src/server/integrations/llm/**`.
- No `'use cache'`, `unstable_cache` or `cacheLife` anywhere under `src/app` except `src/app/(public)`, or under `src/ui` or `src/server`. This covers `api/v1`, `ops`, `i/[token]` and `dev`.
- Server code never calls `Date.now()` directly; it uses `clock.now()`.

MVP files move or go when the slice that needs them touches them, not in one refactor:

| Today | Becomes | Slice |
|---|---|---|
| `src/db/*` (libsql) | `src/server/db/*` (pg) | S1 (done) |
| `src/lib/service.ts`, `src/app/actions.ts` | `src/server/services/*`, thin actions | S2 (done) |
| `src/lib/ai.ts` | replaced by `src/server/integrations/llm/*` (N1 adds `guard.ts`; N2b deletes the file) | S4 |
| `src/lib/extraction.ts` | money helpers to `src/core/money.ts`; the brace parser is deleted | S4 |
| `src/lib/templates.ts` | deleted | N2b |
| `src/server/storage/local.ts`, `services/documents.ts`, `repos/documents.ts`, the `documents` table | deleted; Storage returns in S14, encrypted, for sent letter PDFs only | N2b |
| patient pages (`src/app/page.tsx`, `/plans`, `/claims/*`) | deleted | N2b |
| `src/components/*` | `src/ui/*` | S3c |
| `providers` table, `repos/providers.ts`, `claims.billing_provider_id`, `rendering_provider_id` | deleted; the billing party comes from `clinician_profiles` | N5 |
| `src/lib/packet.ts` | `src/server/documents/packet.ts` (member form, client as payee) | S9 |
| `src/lib/followups.ts`, `followups-adapter.ts`, `follow_ups` table | `src/core/claim/timers.ts` and the `timers` table | S10 |

## 4. Claim state machine

One definition record per state in `src/core/claim/states.ts` holds client and clinician copy keys, chip group, progress segment, timers and on-enter effects, so copy, engine action and timer stay in one place.

```ts
transition(claim, event, payerRules) → { state, effects: Effect[] } | IllegalTransition
```

`transition` is pure. Effects are data: `scheduleTimer`, `cancelTimers`, `notify`, `submitClaim`, `pollStatus`, `openTask`. There is no `chargeFee`. What used to be `requestRecords` is `openTask({ audience: 'clinician', kind: 'letter', requestRef })`; N15 attaches the drafted letter to that task. Every event carries an actor: `clinician | client | system | staff`.

`notify` names its recipients: the client for every state change, and the clinician only when a task is assigned to them. Each recipient gets at most one message per claim event (unique on claim event + recipient); the clinician sees other state changes in an activity list.

States: `draft` `ready` `submitted` `accepted` `rejected_front_end` `in_adjudication` `info_requested` `stalled` `escalated` `applied_to_deductible` `partially_paid` `paid` `denied` `appealed` `misdirected` `closed`.

| From | Event | To |
|---|---|---|
| draft | built from an approved note, validation passes, filing gate says file | ready |
| ready | submit: fires automatically after `note_approved` (N10) on the electronic channel | submitted |
| ready (member_form) | clinician marks it mailed, or a fax confirms | submitted |
| draft, ready | client withdraws filing consent | closed (canceled) |
| submitted and later | client withdraws filing consent | no change; recorded, and no void is sent |
| submitted | 277CA accepted | accepted |
| submitted | 277CA rejected | rejected_front_end |
| submitted | no acknowledgment in 2 business days | stalled |
| submitted | first 277 or EOB (member-form channel has no 277CA) | in_adjudication or an outcome |
| rejected_front_end | corrected and resent (automatic only when no clinical field changes; otherwise a clinician task) | submitted |
| accepted | 277 pending | in_adjudication |
| accepted, in_adjudication | payer requests information (277 R-category, scanned letter) | info_requested |
| accepted, in_adjudication | past payer window | stalled |
| info_requested | clinician-approved letter sent | in_adjudication |
| stalled | 30 days after a clinician-approved inquiry with no decision | escalated |
| accepted, in_adjudication, stalled, escalated, appealed | outcome: paid in full | paid |
| same | outcome: paid in part | partially_paid |
| same | outcome: applied to deductible | applied_to_deductible |
| same | outcome: denied | denied |
| denied, partially_paid | clinician-approved appeal sent | appealed |
| appealed | statutory window passes | escalated |
| paid, partially_paid | payee is not the client | misdirected |
| misdirected | clinician confirms refund to the client (P1, S22; until then a staff exception) | paid |
| paid, partially_paid | client confirms arrival, or two check-ins (day 21, day 35) go unanswered | closed |
| applied_to_deductible | deductible tracker updated | closed |
| denied | appeal window closes or the clinician declines | closed |
| any state before accepted | clinician cancels (frequency code 8 only if already submitted) | closed |

Outcome events come from a 277 status response or a scanned EOB. Anything not in the table is an illegal transition: logged, alerted, never applied.

Submission channel is a property of the claim: `electronic` (the payer's 837P is supported and the clinician's enrollment is active) or `member_form` (a claim form the clinician prints and mails, or Ferry faxes). Both run the same machine. Filing of any kind needs the client's current filing consent and the clinician's signed filing authorization (the filing gate, N10).

Timers are rows in the `timers` table keyed by (subject, kind), with durations from `payer_rules` (median and 90th-percentile days, timely filing, appeal window) and the MVP defaults as fallback.

### Experience mapping

The client's chip is a function of state and whether a client-audience task is open; clinician tasks never change it. The three chips beyond the brand guide's original four were approved 2026-09-17 and are recorded in `FERRY_BRAND.md` §12.

| Chip | Style | States |
|---|---|---|
| One quick thing | blush / navy + hand icon | any state with an open client task (insurance, consent, confirm arrival) |
| We've got it | blush / navy | draft, ready |
| Sent across | mint / seaDeep | submitted, rejected_front_end, accepted, in_adjudication, info_requested, stalled, escalated, appealed, misdirected |
| On its way | mint / seaDeep | paid, partially_paid |
| Landed | sea / white | closed with money back (detail copy differs: confirmed vs. payer-reported) |
| Counted | mint / seaDeep | applied_to_deductible, and closed with deductible credit only |
| Closed | mist / slate | closed with no money and no credit |

List rows show chip plus the state's one-line copy, so a stalled claim reads as being chased, not as unchanged. Progress segments: 1 done at `submitted`, 2 done at `accepted` (or first payer signal on the member-form channel), 3 done at a money or deductible outcome.

## 5. Data model

Postgres via Drizzle. Money in integer cents. Timestamps `timestamptz`. Every table has `user_id NOT NULL` (the clinician tenant, or the user for auth-owned rows and `client_memberships`) unless it is on `GLOBAL_TABLES`; client-scoped tables also have `client_id NOT NULL` (except `tasks`, a listed nullable exception with a CHECK) and are on `CLIENT_SCOPED`. Every text, jsonb or bytea column is classified in `src/server/db/columns.ts`.

| Table | Purpose | Slice |
|---|---|---|
| Better Auth tables | users (role `pending \| clinician \| client \| staff`, set only on the server), sessions, passkeys, verification tokens | S3, N2a |
| `clients` | the clinician's client: sealed names, DOB, email, phone, contact blind index; `client_user_id` once the invite is accepted; `archived_at`. `CLIENT_SELF` | N4 |
| `client_memberships` | `user_id` = the client user; clinician, client, status. How a client user reaches their record; one per clinician | N4 |
| `tenant_keys` | wrapped per-clinician data key | S2b |
| `clinician_profiles` | NPI (unique across tenants), sealed Tax ID with blind index and last four, practice address, license, credential, taxonomy, default note format, NPPES and identity-check timestamps | N5, S6 |
| `fee_schedule_items` | the clinician's charge per CPT code | N5 |
| `clinician_consents` | terms, privacy, BAA, NPI filing authorization: version, content hash, typed name, IP and user agent (all three sealed), withdrawn at. Clinician-only | S3b |
| `client_consents` | client filing and client recording, with signer relationship (self, parent/guardian, legal representative). `CLIENT_SCOPED` | S3b |
| `subscriptions` | Stripe customer and subscription, status, trial end, period end, cancel at period end, has payment method | N6 |
| `billing_events` | Stripe event ids and types only. `GLOBAL_TABLES` | N6 |
| `links` | hashed single-use client invite tokens: expiry, used, revoked | N7a |
| `plans` | insurance plan per client; payer id; sealed member ID (blind index), group, subscriber and patient fields. `CLIENT_SCOPED` | S2, N7b |
| `payers`, `payer_rules` | directory and versioned rules loaded from `data/payers/*.json`. `GLOBAL_TABLES` | S6b |
| `payer_enrollments` | clinician NPI × payer × transaction enrollment status | S6b |
| `nppes_providers` | public registry cache, 30-day TTL. `GLOBAL_TABLES` | S6 |
| `encounters` | a therapy session: client, date of service, clinician-stated start and stop, modality, place of service | N8 |
| `captures` | record, dictate or type; audio ms; relay lease; outputs purged at | N8, N12 |
| `capture_intervals` | connected spans with end reasons; gaps are derived from them | N12 |
| `transcripts` | body sealed under a per-record ephemeral key; `expires_at` = created + 24 h; erased at | N8 |
| `notes` | format, status, approval fields; sealed body, sealed immutable generated body, sealed codes and suggested codes | N9b |
| `scans` | card, insurer mail or EOB: image hashes, attempt, verdict; fields sealed under a 24-hour key until confirmed, then cleared. `CLIENT_SCOPED` | S5 |
| `eligibility_checks` | sealed 271 payloads. Clinician-only | S7 |
| `claims` | state, channel, payer id, totals, payer reference, `note_id` (unique), `encounter_id`, `client_id`; as-filed snapshots of billing party, plan and patient (sealed); sealed diagnosis codes, Tax ID snapshot (plus last four), denial reason. `CLIENT_SCOPED` | S2, S8, N10 |
| `claim_lines` | position, service date, CPT, up to 4 modifiers (database check), units, charge, diagnosis pointers, place of service (sealed codes). `CLIENT_SCOPED` | S2 |
| `claim_events` | append-only: seq, type, from, to, actor, cause, sealed payload. `CLIENT_SCOPED` | S10 |
| `tasks` | one ask for one audience (client, clinician or staff): kind, request ref, status, opened, first viewed, done. `client_id` required for client-audience tasks (CHECK). `CLIENT_SCOPED` as a listed nullable exception | S10 |
| `timers` | subject, kind, due at, fired at; UNIQUE(subject, kind) | S10 |
| `dev_clock` | the dev-tier clock offset. `GLOBAL_TABLES` | S10 |
| `letters` | kind, sealed body, PDF key, citations, route, approval (signature, time, hash), sent and viewed times. Clinician-only | S14, N15 |
| `external_calls` | vendor, purpose, input and output hashes and sizes, timing, status, idempotency key. A sealed payload only when it is itself a kept record (837P, 277CA); never model input or output | S4, S9 |
| `notifications` | one row per claim event and recipient: channel, PHI-free body, delivery status | S10, S18 |
| staff audit | every `staffActFor` action | S9 |

Gone: `documents`, `providers`, `follow_ups`, `events`, `consents`, `user_keys`, `patient_tasks`, `action_links`, `fee_events`, `provider_accounts`. Session audio and scan photos are never stored anywhere.

Ids are prefixed ULIDs (`clm_`, `pln_`, `lin_`, `cli_`, `mbr_`, `prf_`, `enc_`, `cap_`, `trn_`, `not_`, `scn_`, `ltr_`, `tsk_`, `tmr_`, `cev_`, …). Dates of service are Postgres `date` values read as `YYYY-MM-DD` strings; anything derived from one is anchored at noon UTC so it shows as the same calendar day across US time zones.

`claims.state` and the matching `claim_events` row are written in one transaction, along with the effects to run. Current state is a projection of the log; the log is never updated or deleted except by account deletion.

## 6. Tenancy and security

### Access model (N2a, enforced in data by N4)

1. **Tenant.** The clinician is the tenant. Every row about a client's care has `user_id` = the clinician. Exceptions: `client_memberships` has `user_id` = the client user, and the Better Auth tables are auth-owned.
2. **Contexts** (`src/server/auth/ctx.ts`, discriminated on `scope`):
   - `ClinicianCtx {scope:'clinician', userId}` from `requireClinician()`.
   - `SelfCtx {scope:'self', userId}` from `requireClient()`; it reads only that user's own `client_memberships`.
   - `ClientCtx {scope:'client', userId = tenant, clientId, actorId}`, built only by `clientCtxFor(self, membershipId)`.
   - `InviteCtx {scope:'invite', userId = tenant, clientId, actorId, linkId}`, built only in `services/invites.ts`; only the links repo, `clients.client_user_id` and `client_memberships` accept it.
   - `SystemCtx {scope:'system', userId = tenant, job}`, built only by `systemCtx(tenantId, job)` in jobs, the relay, webhooks and `services/ops.ts`.
   - `StaffCtx {scope:'staff', userId}` from `requireStaff()`. No tenant repo accepts it; it reaches only `repos/ops.ts` (cross-tenant ids, kinds, ages and counts, never sealed columns) and `staffActFor(staff, taskId)`, which writes an audit row and returns a `SystemCtx` for that task's tenant.
   - `Ctx = ClinicianCtx | ClientCtx | SystemCtx`; `ClinicianOnlyCtx = ClinicianCtx | SystemCtx`.
3. **`clientCtxFor`** succeeds only when the membership belongs to the caller and is active, and its `clients` row belongs to that clinician, is bound to the caller and is not archived. Anything else throws `NotOwnedError`, which becomes a 404.
4. **`tenantWhere(table, ctx)`** filters `user_id = ctx.userId`. For a `ClientCtx` it also filters `client_id` on `CLIENT_SCOPED` tables and `id` on `CLIENT_SELF` (`clients`), and throws on any other table.
5. **Clinician-only repos** type ctx as `ClinicianOnlyCtx` and also refuse a `ClientCtx` at run time: clinician profiles, fee schedule, clinician consents, encounters, captures, capture intervals, transcripts, notes, letters, eligibility checks, external calls, subscriptions, notifications.
6. **Client reads** go only through strict zod DTOs in `src/core/api/trips.ts`: their own client row (first name, contact), plans, their own client consents, claims (no diagnosis by default), timeline entries (state, time, copy key), client-audience tasks and letters sent as `{kind, payerName, sentAt}`. No DTO has a note field, a letter body or any Tax ID.
7. **Client writes** go through services taking `ClientCtx`: their own consents, insurance entry and card scans, insurer-mail scans, confirm arrived. Clinician-side follow-up (eligibility, filing waiting claims) is enqueued as a job carrying the tenant id, never run in the client's request.
8. **Resolvers.** `repos/resolvers.ts` is the only repo module with ctx-less functions, and it returns ids only: user id by email (staff:grant), invite token hash, Stripe customer, patient control number, due timers, expired transcripts and scans.
9. **Roles** are set only on the server: `/start` makes a clinician (N5), `acceptInvite` makes a pending user a client and refuses clinicians and staff (N7a), `bun run staff:grant` makes staff. One role per user at launch. `acceptInvite` binds only a user whose verified email (or SMS-verified phone) matches the contact the clinician entered.
10. A client of two member clinicians has two memberships; client views iterate them.
11. **Clinician claim views** use a strict DTO exposing `tax_id_last4` only (S9).

Postgres row-level security (S28a) adds a second layer: `ferry_app` runs with FORCE RLS on every tenant table using `app.tenant` and `app.client_id` set per transaction; `ferry_resolver` runs the security-definer functions behind `resolvers.ts` and `repos/ops.ts`.

### Deploy tiers and modes

`FERRY_DEPLOY_TIER` decides which integration modes may boot (`bootProcess()` in every process; each failure names the vendor):

| Tier | Allowed modes | Serves |
|---|---|---|
| dev | anything; fixtures by default | everything, plus `/dev/*` with a per-run key |
| prelaunch | every vendor `off` | public pages only (`PRELAUNCH_PATHS`: /, /for-clients, /legal/*, /icons/*; not installable) |
| staging | `live`, `test` or `off`; never `fixture` or `local` | everything, synthetic data only (boot refuses any other `FERRY_DATA_CLASS`) |
| prod | `live`, with `off` only for sms and fax | everything, beta allow-list until `FERRY_OPEN_SIGNUP=1` |

`FERRY_PRELAUNCH=1` puts any tier in the prelaunch mode (public pages only; Start free becomes Join the beta); the prelaunch tier implies it. `isPrelaunch()` fails closed: any non-empty value but `0` turns it on, and boot refuses anything but `0` or `1`. The prelaunch and prod tiers (and staging with `FERRY_PRELAUNCH=1`) refuse to boot while the contact address in `src/core/site.ts` is a placeholder; only a local prelaunch run may set `FERRY_ALLOW_PLACEHOLDER_CONTACT=1` (prelaunch.test.ts, `lighthouse:home`).

`FERRY_DATA_CLASS` is `synthetic | deidentified | real`, and unset counts as `real`, so every synthetic-only check needs the explicit value; `real` is refused while `bun run preflight:real-data` fails. The dev tier boots only against a database ending `_dev` or `_test`. Unhandled errors print only the error name, in every process: the console scrubber is on in every tier but dev (and whenever NODE_ENV=production). The worker and relay exit on an unhandled error; Next logs it and stays up.

### Encryption and keys

- **Per-tenant data key.** A 256-bit data key per clinician tenant (`tenant_keys`), wrapped by a key-encryption key through `KeyProvider` (`local` in dev only, `aws-kms` otherwise). A `ClientCtx` decrypts with its tenant's key inside the repos, so a canceled clinician's filed claims stay readable to their clients until they close.
- **Per-record ephemeral keys outside Postgres.** Transcripts, dictation text, typed rough notes and unconfirmed scan fields are sealed with `sealEphemeral` under a key held in an `EphemeralKeyStore` (a local key directory in dev; DynamoDB with point-in-time recovery and backups off and TTL on in AWS). Reads refuse a record past `expires_at` on the server clock even before erasure runs; an edit re-seals under the same key without moving `expires_at`. Erasure (keyed timer, 15-minute sweeper with a lag alert, S3 lifecycle backstop for HealthScribe output) destroys the key first, then nulls the ciphertext. A restored backup copy can't be decrypted.
- Keys are chosen by `modeFor('keys')` and `modeFor('ephemeralKeys')`: `fixture` and `local` are the on-machine implementations (a key-encryption key from `FERRY_LOCAL_KEK` or `bun run keys:dev`'s `data/keys/kek`; one key file per record under `data/keys/ephemeral`), dev tier only; `live` and `test` are KMS (tenant id in the encryption context) and DynamoDB (`assertKeyTableSafe` requires point-in-time recovery, backups, streams, Kinesis destinations and replicas off and TTL on; the table stays out of every AWS Backup plan) over the narrow `KmsApi` and `DynamoApi` interfaces, wired to the SDK in S21a.
- Fields are AES-256-GCM, stored as `v1.<keyId>.<iv>.<ciphertext>.<tag>`. One repo-level column codec (`src/server/db/codec.ts`) seals, decodes and derives blind indexes and last fours from the lists in `src/server/db/columns.ts`; `columns.ts` classifies every text, jsonb or bytea column as `SEALED`, `EPHEMERAL` or `PLAINTEXT_OK`, and a test fails on a new unclassified column.
- Sealed: client names, DOB, email, phone; member ID, group and subscriber details; diagnosis codes and CPT lines; the claims' as-filed patient and plan snapshots; note bodies (`body`, `generated_body`), codes and suggested codes; the Tax ID; practice address; typed signatures; letter bodies; event payloads; eligibility payloads; kept vendor records. Plaintext operational columns: state, payer id, channel, amounts, timestamps. `users.email` stays plaintext because Better Auth looks it up; RDS encryption at rest covers it. `users.name` is always empty (Better Auth requires the column; database hooks blank any name a request sends), so no one's name is stored outside a sealed row.
- Blind indexes (HMAC-SHA256 under the tenant's separate index key) on client email, client phone and member ID for lookup and de-duplication. A Tax ID blind index is future work: matching a Tax ID across tenants needs a global index key, not a per-tenant one.
- Every sealed value is bound to its table, column and row id (the AES-GCM associated data), so a ciphertext copied to another row or column won't open. Only the repos reach tenant keys (`repos/tenant-keys.ts`, `keyringFor(ctx)`); a clinician's key is made in the same transaction that gives them the clinician role (`usersRepo.changeRole`), never on first use, and a tenant with no key row gets `KeyUnavailable`. Lint limits the key and ciphertext modules to `src/server/crypto`, the repos, `db/codec.ts`, `db/testing.ts` and, for ephemeral keys, `src/server/jobs`.
- A solo clinician's Tax ID is often their SSN. It is always sealed, shown as the last four, never logged, and never in any LLM input.
- No side copies: model call logs keep hashes only, job payloads are ids only, job failures record only the error name, note evidence stores segment ids, and `'use cache'` is banned on PHI paths.
- Logger redacts by allow-list. No PHI in logs, Stripe metadata, SMS or email bodies, error output or Bedrock invocation logs (off, checked at boot).
- Audit: staff actions and reads go through `staffActFor` and are recorded; clinician and client reads are not.

## 7. Jobs and effects

- Effects returned by `transition` are persisted in the same transaction as the state change, then executed by the worker with retries. Handlers are idempotent on `effect_id`.
- Job payloads are validated by a strict zod schema of prefixed ids, enums and numbers only. A failing handler's error is rethrown with only its name, so `pgboss.job` and `pgboss.archive` hold no text. The worker builds a `SystemCtx` from the job's tenant id.
- Timers are `timers` rows keyed by (subject, kind); scheduling the same key replaces the earlier timer, and entering a state cancels timers that no longer apply. A tick job every minute enqueues immediate work for due timers.
- "Exactly one notification per state change" holds because `notify` is produced only by `transition`, once per applied transition, and delivery is unique on (claim event, recipient).
- Every vendor call goes through `external_calls` with an idempotency key. Webhooks and polled responses are de-duplicated on vendor reference before they become events.
- A manual intervention by a human is an event type with an actor, so the most frequent exception is measurable and is the next thing automated.

## 8. Integrations

Each integration exposes a narrow interface with `live`, `test` (vendor sandbox) and `fixture` (recorded responses) implementations, chosen by `modeFor(vendor)` from `FERRY_<VENDOR>_MODE` (`live | test | fixture | off`; calling an `off` vendor throws `VendorOff`). Dev defaults to `fixture`; the deploy tier decides which modes may boot (§6).

| Vendor | Notes |
|---|---|
| Stedi | Test claims need a pay-as-you-go account with a test key; send to payer `STEDI`. The test payer always accepts and pays, so rejected 277CAs and all 276/277 responses are fixture-only. Eligibility mocks have no mental-health or out-of-network data, so the out-of-network gate is tested on hand-written 271s. Route per payer on `transactionSupport` and per-NPI enrollment. Validation is Stedi's claim edits, run on every submission (HTTP 400 with `errors[]`); there is no validate-only call. Stedi's generated CMS-1500 PDF is fetched on demand for clinicians and never stored. Stedi carries only unsolicited 275 attachments, so it never carries a letter an insurer asked for. |
| LLM | `LlmProvider`: `bedrock` (`us.anthropic.claude-sonnet-5`, us-east-1) or `anthropic` (direct API, synthetic data in the dev tier only), or `fixture`. Sonnet 5 has no structured outputs on Bedrock, so every schema-bound call is a forced tool call validated with zod and retried once. `llmFor(ctx)` refuses any input containing the tenant's Tax ID. The call log keeps hashes, sizes, timing and status only. |
| Scribe | `Scribe`: AWS HealthScribe streaming for recorded sessions (transcript and note; output files deleted from S3 on import) and Amazon Transcribe Medical streaming for dictation (transcript only, capped at 5 minutes). us-east-1 only. Audio arrives from the relay as 16 kHz PCM. |
| NPPES | Public registry, cached in `nppes_providers` for 30 days. |
| SMS | Twilio or AWS End User Messaging; optional at launch (email carries every message until an SMS BAA and A2P land). Bodies are a link only. |
| Sinch Fax | Letters an insurer asked for, and member-form claims where the payer lists a fax. Document storage off, 2FA on, per their BAA terms. |
| SES | Outbound mail only, through the no-PHI send wrapper. |
| Stripe | Stripe Billing: one subscription per clinician with a 7-day no-card trial that pauses without a payment method, and the Customer Portal for card and cancel. Metadata and descriptions carry an opaque ref only. |

Membership rule (replaces the per-claim fee rule): access follows the pure `entitlementsFor(facts, now)`. Trial or active is full access. No card after the trial, or a lapse after cancellation, is read-only: nothing is deleted, filed claims are chased to closure, the clinician can still draft, approve and send letters for claims filed before the lapse, and notes stay exportable for 30 days after cancellation. Day-5 and day-7 trial reminders are timers. The price and trial length live only in `PRICING`; clients never pay and nothing is priced per claim.

## 9. Shared primitives

Built once in the first slice that needs them, reused after.

| Primitive | Built in | Reused by |
|---|---|---|
| Access model: contexts, `tenantWhere`, `clientCtxFor`, resolvers | N2a, N4 | every repo |
| `modeFor`, deploy tiers, `bootProcess`, `assertDevTier`, error scrubbing | N1 | every integration and process |
| Envelope and ephemeral encryption, column classification, `rawDump` / `decryptedDump` | S2b | N8, S5, N12, S14, every test that checks erasure |
| Consent records and legal gates (`requireFilingConsent`, `requireRecordingConsent`, `assertLiveLegal`) | S3b | N5, N7b, N8, S9, N11, N12, N15 |
| Entitlements (`entitlementsFor`, `requireEntitlement`) | N6 | N8, N9b, N10, N15 |
| Job queue, timers table, tick, dev clock, `openTask` | S10 | N6, N8, N12, S13, N15, S17 |
| Invite links and the no-PHI send wrapper (`assertNoPhi`) | N7a | N6 reminders, S18 |
| LLM provider (`llmFor`, forced tool call, hash-only log) and scorer | S4 | N9b, N11, S5, S16, N15 |
| Capture relay and `Scribe` | N3a, N11, N12 | N13 |
| Scan reading and `frameVerdict` | S5 | S4b, S16 |
| `validate(claim, payerRules)` | S8 | S9 |
| Letter engine (Storage, PDF, fax and print-and-mail routes) and cited drafting | S14, N15 | S16, S17 |
| Payer directory and enrollments | S6b | N7b, S8, S9, S14 |
| `claim_events` log | S10 | S12, S29, payer ETA statistics, S27 (P2) |

## 10. API and clients

- Services are the only write path. Server actions and `/api/v1/*` route handlers are thin transports over the same service functions; server components may call services for reads.
- `/api/v1`: JSON, zod-validated input and output, errors as `{ code, message }`. Session cookie auth now; bearer tokens added when the Expo apps arrive.
- No anonymous capture: clinicians sign in, and clients arrive by an invite bound to the contact the clinician entered. Eligibility runs as a job only after the client's filing consent and the clinician's filing authorization, because it costs money and sends data to a payer.
- UI: Tailwind 4 theme from the brand tokens, Bricolage Grotesque and Figtree, Lucide icons, 390-wide reference canvas for phones and 1280 for the clinician desktop, no dark mode. iOS web push works only after Add to Home Screen, so email (and SMS once live) carries notifications for most of the beta.

## 11. Error handling

- Illegal transitions are rejected, logged with the claim's correlation id, and alerted. State never changes outside `transition`.
- Vendor failures retry with backoff inside the job; after the last attempt the claim gets a staff exception task and the client sees nothing alarming unless action is needed.
- A scan with a required field below confidence asks for that field only on the confirm screen; an unresolved payer opens one task for whoever scanned.
- A rejected 277CA maps to a fix class: `auto` (corrected and resent only when no clinical field changes), `clinician`, `client` (one task for that audience) or `staff` (an exception).
- Every user-facing error string follows the brand voice: no codes, no instructions without a reason, one ask at a time.

## 12. Testing

- `core`: exhaustive unit tests. Every legal transition, every illegal pair, timer math, entitlements, code rules, 837P mapping snapshots over synthetic note fixtures with CLM07 = C, CLM08 = N and Box 13 blank asserted on every claim (property test).
- `server`: integration tests against a real local Postgres 17, including isolation tests that prove a clinician, another clinician and a client each reach only what the access model allows through every repo, and raw-dump and decrypted-dump tests that prove erasure.
- Integrations: contract tests replay `fixtures/` and mocked SDK clients; `test` mode runs as each key arrives (N16).
- Scoring: `corpus:score` reports per-field accuracy against `corpus/**/labels.json`; gates count only with a real model.
- End to end: Playwright against `ferry_e2e_test` with the worker and relay as web servers and the shared dev clock; Gates C, D and E2 are walkthroughs.
- Every slice ends with `test`, `typecheck` and `lint` green (plus `test:e2e` when it has e2e acceptance), then one commit.

## 13. Environments

| Env | Tier | Data | Stack |
|---|---|---|---|
| dev | dev | synthetic only | local Postgres 17, local key directory and KEK, integrations in `fixture` or `test`; `dev:phone` tunnel for phones |
| preview | prelaunch | none (public pages only) | any host, every vendor off |
| staging | staging | synthetic only (`FERRY_DATA_CLASS=synthetic`; boot refuses any other class in the staging tier) | AWS account A, same topology as prod, Stedi and Stripe in test mode |
| prod | prelaunch until Gate E, then prod | real PHI, only after every BAA is signed and `preflight:real-data` passes | AWS account B: ECS Fargate (web, worker, relay), ALB with `/ws/*` to the relay, RDS Postgres with PITR, S3, KMS, DynamoDB key table, SES, Bedrock, HealthScribe, Transcribe Medical, CloudWatch |

Both AWS accounts sit in one Organization with the BAA accepted in AWS Artifact and an AI services opt-out policy attached to the root. Infrastructure is code (CDK, S21a) from the first deploy; S21b provisions it.

BAA inventory: AWS (database, storage, keys, LLM, speech, email, compute), Stedi (click-through on upgrade), Sinch, and the SMS vendor if SMS is on. Not needed: Stripe (payment-processing exemption, no PHI sent). Error monitoring stays in CloudWatch until a vendor with a BAA is chosen.

## 14. Not building in Phase 1

Microservices, Kubernetes, multi-region, a message bus, GraphQL, a data warehouse, store apps (P1), 835 ingestion, dark mode, the learned allowed-amount table, EHR integrations (P2), calendar sync, stored audio or scan photos.

## 15. Open questions for humans

1. Attorney and Stedi support: on what legal basis does the clinician's in-app filing authorization let Ferry submit an 837P under that clinician's NPI with AI-drafted content, and does Stedi's agreement permit it? (Q-L1)
2. ~~AWS: is SES inbound receiving covered by the BAA?~~ Closed 2026-09-27: inbound mail existed only for the email inbox, which was dropped with S19. SES is outbound only.
3. Attorney: may a push notification body carry a dollar amount with no payer, clinician, diagnosis or date? Default until answered: amounts allowed in push, nothing but a link in SMS.
4. Attorney: is a typed-name e-signature sufficient for the client consents, the clinician's filing authorization and letter approval?
