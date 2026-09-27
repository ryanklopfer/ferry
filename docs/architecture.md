# Ferry — Phase 1 architecture (2026-09-17)

The validated design for the 60-day sprint. Product intent lives in `mentaya-teardown-and-product-framework.md`; schedule and slices in `60-day-sprint.md` and `sprint-tasks.md`; voice and UI in `FERRY_BRAND.md`. Where those documents disagree with this one on a technical point, this one wins and the decisions table says why.

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Patient client is a responsive Next.js web app (PWA). Backend is API-ready so an Expo client can attach in Week 3+ or Phase 2. | First-claim funnel is SEO page → camera with no install; one codebase inside the 21-day build window; Apple org enrollment needs a D-U-N-S number and the LLC does not exist yet. Supersedes the "Expo" note in the Cowork scaffold. |
| D2 | Modular monolith: one repo, one package, two processes (web, worker), one Postgres. | Year-3 base case is ~2,000 claims/day. Throughput is not the constraint; correctness per payer, support cost per claim, auditability and adding clients are. |
| D3 | `src/core` is pure TypeScript with no I/O, enforced by lint. Promoted to `packages/core` when a second consumer (Expo) exists. | Keeps the state machine, fee rules and 837P mapping testable and portable without paying monorepo overhead now. |
| D4 | The state machine has 16 states (the §3.4 table), not 14. | The table is the source of truth; the prose count was wrong. |
| D5 | Tracker is layered: brand chips and the three-segment bar on lists; every state visible on trip detail in Ferry voice; codes, reference numbers and reimbursement math behind a details tap. | Keeps the glass-box differentiator (framework M3) without breaking the brand voice. |
| D6 | Copy never asserts something Ferry cannot observe. `paid` means the payer issued payment, shown as "On its way." The "It landed" push and celebration fire only when the patient confirms arrival. A claim closed without confirmation states what the payer reported ("Cigna sent $126 on Sep 14"). | Ferry never touches the money; most non-assigned claims pay by mailed check. |
| D7 | Definition of done applies as written to payers whose 837P is `SUPPORTED` in Stedi without enrollment. For `ENROLLMENT_REQUIRED` payers, done = member-form packet ready in under five minutes and enrollment tracked. | Stedi enrollment is per provider NPI per payer and takes 24–48 h, up to 30 days. |
| D8 | AWS is the PHI stack: RDS Postgres, S3, KMS, Bedrock, SES, ECS Fargate, and AWS HealthScribe for session notes (2026-09-27), all in us-east-1 because HealthScribe runs only there. | One free self-serve BAA (AWS Artifact) covers database, storage, keys, LLM, email and compute. Supabase HIPAA is ~$950+/mo against a $200–500 budget line; App Runner is closed to new customers. |
| D9 | Auth is Better Auth (magic link + passkey plugins, Drizzle pg adapter) in our own database. | No auth vendor, no extra BAA, vendor-neutral. |
| D10 | Jobs run on a Postgres-backed queue (pg-boss). | Timers, polling, notifications and letters need durable delayed jobs; no new vendor, no new BAA. |
| D11 | No 835 ingestion in Phase 1. Adjudication signals are 276/277 and patient EOB photos. | ERA enrollment is exclusive per provider per payer; enrolling a provider through us would take their existing feed. |
| D12 | E-fax is Sinch Fax API, not Twilio. | Twilio Programmable Fax was shut down in December 2021. Sinch signs a free self-serve BAA. |
| D13 | Product analytics inside the app come from our own `claim_events` log. PostHog is limited to public marketing pages. | PostHog's BAA requires a $250/mo package; the funnel dashboard (slice 21) and scorecard (slice 27) already read the same log. |
| D14 | "Ferry" is a working name held in one constant. The domain word in code is `claim`; "trip" is UI copy only. | Name decision is due Day 10. |
| D15 | One branch and one commit per slice; when test, typecheck and lint pass, fast-forward `main` and delete the branch without asking. Never push, force or rewrite history without asking. | Agreed 2026-09-17. Solo engineer, strict per-slice checks; pull requests start when there is a second reviewer or SOC 2 evidence collection begins. |

## 2. System shape

```
browser (patient PWA, provider action links, public pages)
        │  HTTPS
        ▼
  web process ── Next.js 16: UI, /api/v1, /api/webhooks
        │
        ├── services ──► core (pure rules)
        │       │
        │       ▼
        │   Postgres ◄── worker process (pg-boss): timers, polling,
        │       ▲          notifications, letters, extraction, fees
        │       │
        └── integrations: Stedi · NPPES · LLM (Bedrock) · SMS (Twilio)
                          · fax (Sinch) · email (SES) · Stripe · storage (S3)
```

Two processes from the same codebase. The worker is `worker.ts`; it imports the same services and integrations as the web process.

## 3. Code layout and boundaries

```
src/core/        pure domain, no I/O
  claim/         states, events, transition(), timers, chip/segment mapping
  fees/          pay-when-paid, cap, Autopilot pause rules
  x12/           claim record → 837P JSON mapping; 277CA/277 → domain events
  validation/    validate(claim, payerRules) → Issue[]   (slice 8, extended in 25)
  extraction/    zod schemas + prompts: superbill, insurance card, EOB
  letters/       template registry (inquiry, appeal ×3, DOI, misdirected, records request)
  money.ts       cents helpers
src/server/
  db/            drizzle pg schema, migrations, repos (tenant-scoped, seal/open PHI)
  crypto/        envelope encryption, KeyProvider (local | aws-kms), blind index
  storage/       Storage interface (local disk | s3)
  jobs/          queue setup, effect dispatcher, handlers
  integrations/  stedi/ nppes/ llm/ sms/ fax/ email/ stripe/   (each: interface, live, fixture)
  services/      use cases: the only code that writes
  documents/     packet PDF, letter PDF
src/app/         Next.js routes: (patient) · (public) · p/[token] · api/v1 · api/webhooks
src/ui/          components built from brand tokens
worker.ts
corpus/          synthetic/ (in git) · real/ (gitignored, de-identified only)
fixtures/        recorded vendor responses (277CA, 277, 271, EOB parses)
data/payers/     payer directory and rules as JSON, loaded into tables
```

Lint-enforced rules (`no-restricted-imports`):

- `src/core/**` may import only `zod`, `date-fns` and other `src/core` modules.
- `src/app/**` and `src/ui/**` may not import `drizzle-orm` or `@/server/db/**`. Reads and writes go through `@/server/services`.
- Only `src/server/db/repos/**` sees ciphertext.

MVP files move when the slice that needs them touches them, not in one refactor:

| Today | Becomes | Slice |
|---|---|---|
| `src/db/*` (libsql) | `src/server/db/*` (pg) | 1 |
| `src/lib/service.ts`, `src/app/actions.ts` | `src/server/services/*`, thin actions | 2 |
| `src/lib/extraction.ts` | `src/core/extraction/superbill.ts`, `src/core/money.ts` | 4 |
| `src/lib/ai.ts` | `src/server/integrations/llm/*` | 4 |
| `src/lib/followups.ts` | `src/core/claim/timers.ts` (payer-parameterized) | 10 |
| `src/lib/templates.ts` | `src/core/letters/*` | 14 |
| `src/lib/packet.ts` | `src/server/documents/packet.ts` | 11 |

## 4. Claim state machine

One definition record per state in `src/core/claim/states.ts` holds patient copy key, chip group, progress segment, timers and on-enter effects, so copy, engine action and timer stay in one place.

```ts
transition(claim, event, payerRules) → { state, effects: Effect[] } | IllegalTransition
```

`transition` is pure. Effects are data: `scheduleTimer`, `cancelTimers`, `notify`, `generateLetter`, `submitClaim`, `pollStatus`, `requestRecords`, `chargeFee`, `openPatientTask`.

States: `draft` `ready` `submitted` `accepted` `rejected_front_end` `in_adjudication` `info_requested` `stalled` `escalated` `applied_to_deductible` `partially_paid` `paid` `denied` `appealed` `misdirected` `closed`.

| From | Event | To |
|---|---|---|
| draft | review confirmed, validation passes | ready |
| ready | submit (tap, or automatic with Autopilot) | submitted |
| submitted | 277CA accepted | accepted |
| submitted | 277CA rejected | rejected_front_end |
| submitted | no acknowledgment in 2 business days | stalled |
| submitted | first 277 or EOB (member-form channel has no 277CA) | in_adjudication or an outcome |
| rejected_front_end | corrected and resent | submitted |
| accepted | 277 pending | in_adjudication |
| accepted, in_adjudication | payer requests records | info_requested |
| accepted, in_adjudication | past payer window | stalled |
| info_requested | records sent | in_adjudication |
| stalled | 30 days after inquiry with no decision | escalated |
| accepted, in_adjudication, stalled, escalated, appealed | outcome: paid in full | paid |
| same | outcome: paid in part | partially_paid |
| same | outcome: applied to deductible | applied_to_deductible |
| same | outcome: denied | denied |
| denied, partially_paid | appeal sent | appealed |
| appealed | statutory window passes | escalated |
| paid, partially_paid | payee is not the patient | misdirected |
| misdirected | provider confirms refund to patient | paid |
| paid, partially_paid | patient confirms arrival, or two check-ins (day 21, day 35) go unanswered | closed |
| applied_to_deductible | deductible tracker updated | closed |
| denied | appeal window closes or patient declines | closed |
| any state before accepted | patient cancels | closed |

Outcome events come from a 277 status response or a parsed EOB. Anything not in the table is an illegal transition: logged, alerted, never applied.

Submission channel is a property of the claim: `electronic` (provider has authorized and the payer is `SUPPORTED`) or `member_form` (packet PDF). Both run the same machine.

Timers take their durations from `payer_rules` (median and 90th-percentile days, timely filing, appeal window) and fall back to the MVP defaults in `RULES`.

### Experience mapping

Chip is a function of state and whether a patient task is open. The three chips beyond the brand guide's original four were approved 2026-09-17 and are recorded in `FERRY_BRAND.md` §12.

| Chip | Style | States |
|---|---|---|
| One quick thing | blush / navy + hand icon | any state with an open patient task (send tap, approve appeal, retake photo) |
| We've got it | blush / navy | draft, ready |
| Sent across | mint / seaDeep | submitted, rejected_front_end, accepted, in_adjudication, info_requested, stalled, escalated, appealed, misdirected |
| On its way | mint / seaDeep | paid, partially_paid |
| Landed | sea / white | closed with money back (detail copy differs: confirmed vs. payer-reported) |
| Counted | mint / seaDeep | applied_to_deductible, and closed with deductible credit only |
| Closed | mist / slate | closed with no money and no credit |

List rows show chip plus the state's one-line copy, so a stalled claim reads as being chased, not as unchanged. Progress segments: 1 done at `submitted`, 2 done at `accepted` (or first payer signal on the member-form channel), 3 done at a money or deductible outcome.

## 5. Data model

Postgres via Drizzle. Money in integer cents. Timestamps `timestamptz`.

| Table | Purpose |
|---|---|
| Better Auth tables | users, sessions, passkeys, verification tokens |
| `user_keys` | wrapped per-user data key, key id, created/rotated |
| `consents` | document type, version hash, signed at, IP, user agent |
| `plans` | insurance plan per patient; payer id; sealed member ID, group, subscriber details |
| `providers` | One patient's record of a provider: name, NPI, sealed Tax ID and type, address, credential, license. Never shared between patients (S2) |
| `nppes_providers` | Public registry copy keyed by NPI; the only trusted source for shared provider facts (S6) |
| `provider_accounts` | What a provider controls themselves: authorization, licenses, defaults (S11, S24) |
| `claims` | state, channel, payer id, totals, payer reference, timestamps; a snapshot of billing and rendering provider as filed, plus optional links to `providers`; sealed clinical fields |
| `claim_lines` | position, service date, CPT, up to 4 modifiers (database check), units, charge, diagnosis pointers, place of service (sealed) |
| `claim_events` | append-only: seq, type, from, to, actor, cause, sealed payload |
| `patient_tasks` | the single thing a patient is asked to do, with resolution |
| `documents` | superbills, cards, EOBs, letters, packets: storage key, kind, hash |
| `action_links` | signed provider links: purpose, scope, expiry, used at |
| `letters` | template, rendered body (sealed), channel, delivery status |
| `external_calls` | vendor, operation, idempotency key, sealed request/response, status, latency |
| `fee_events` | claim, basis amount, fee, cap applied, Stripe reference, reversal |
| `payers`, `payer_rules` | directory and versioned rules loaded from `data/payers/*.json` |
| `notifications` | one row per state change: channel, PHI-free body, delivery status |

Provider data sits at three trust levels and never mixes: what a patient told us (`providers`, per user), what the registry says (`nppes_providers`), and what the provider controls (`provider_accounts`). A record learned from one patient's superbill must not flow into another patient's claim: that would leak data and let one user poison a real NPI's details for everyone.

Ids are prefixed ULIDs (`clm_`, `pln_`, `lin_`, `prv_`, `doc_`, `fup_`, `evt_`). Dates of service are Postgres `date` values read as `YYYY-MM-DD` strings; anything derived from one is anchored at noon UTC so it shows as the same calendar day across US time zones.

`claims.state` and the matching `claim_events` row are written in one transaction, along with the effects to run. Current state is a projection of the log; the log is never updated or deleted except by account deletion.

## 6. Tenancy and security

- The patient account is the tenant. Every PHI table carries `user_id`. Repos require a `Ctx { userId, role }` and scope every query; there is no unscoped repo method. Reads of another user's rows return nothing, changes to them affect nothing, and attaching a new row to a parent you do not own throws `NotOwnedError`, which transports turn into a 404 so "not yours" and "does not exist" look the same. `schema.test.ts` fails if any new table lacks an owner; `isolation.test.ts` exercises every repo as a second user. Postgres row-level security is added in hardening (slice 28) as defense in depth.
- Envelope encryption: a 256-bit data key per user, wrapped by a key-encryption key through `KeyProvider` (`local` from env in dev, `aws-kms` in prod). Fields are AES-256-GCM, stored as `v1.<keyId>.<iv>.<ciphertext>.<tag>`.
- Sealed (field-level): names, DOB, addresses, phone, member ID, group number, diagnosis codes, CPT lines, provider Tax ID, payer messages, letter bodies, event payloads, vendor requests/responses. Plaintext operational columns: state, payer id, channel, amounts, timestamps. Auth identity (email, phone) stays in the auth tables under database-level encryption.
- Blind indexes (HMAC-SHA256 with a separate key) on member ID and provider Tax ID for lookup and de-duplication.
- A solo clinician's Tax ID is often their SSN. It is always sealed, masked to the last four in UI, and never logged.
- Files are encrypted with the user's data key before storage, and the bucket uses SSE-KMS. Deleting a user's wrapped key makes their fields and files unrecoverable, which is how account deletion is enforced.
- Logger redacts by allow-list. No PHI in logs, Stripe metadata, PostHog, SMS bodies or error reports. Every claim-scoped log line carries a correlation id.
- Audit: reads of PHI by staff roles are recorded; patient-initiated reads are not.

## 7. Jobs and effects

- Effects returned by `transition` are persisted in the same transaction as the state change, then executed by the worker with retries. Handlers are idempotent on `effect_id`.
- Timers are delayed jobs keyed by `(claim_id, timer_kind)`. Entering a state cancels timers that no longer apply, replacing `staleFollowUps`.
- "Exactly one notification per state change" holds because `notify` is produced only by `transition`, once per applied transition.
- Every vendor call goes through `external_calls` with an idempotency key. Webhooks and polled responses are de-duplicated on vendor reference before they become events.
- A manual intervention by a human is an event type with an actor, so the most frequent exception is measurable and is the next thing automated.

## 8. Integrations

Each integration exposes a narrow interface with three implementations selected by env: `live`, `test` (vendor sandbox) and `fixture` (recorded responses). Development defaults to `fixture` until accounts exist.

| Vendor | Notes |
|---|---|
| Stedi | Test claims need a pay-as-you-go account with a test key; send to payer `STEDI`. The test payer always accepts and always pays every line, so rejected 277CAs and all 276/277 responses are fixture-only. Mock eligibility answers only for Stedi's predefined subscribers. Route per payer on `transactionSupport`. Validation is Stedi's claim edits, run on every submission (HTTP 400 with `errors[]`); there is no validate-only call. Stedi generates a CMS-1500 PDF for every submitted claim; we attach it to the timeline. |
| LLM | `LlmProvider`: `bedrock` (`us.anthropic.claude-sonnet-5`, US inference profile) or `anthropic` (direct API). The direct provider refuses to run unless `FERRY_DATA_CLASS=synthetic`, and never in production. Extraction uses schema-constrained output, not brace-matching. |
| NPPES | Public registry, cached in `providers`. |
| Twilio | SMS only. Bodies carry no names, payers, codes or dates of service. |
| Sinch Fax | Outbound letters and member-form packets where the payer directory says fax. Document storage off, 2FA on, per their BAA terms. |
| SES | Outbound mail and the Autopilot inbound inbox. Inbound coverage under the AWS BAA to be confirmed (open question 2). |
| Stripe | Card on file, fee charges, reversals, Autopilot subscription. Descriptions and metadata carry an opaque claim id only. |

Fee rule: a fee fires on entering `paid` or `partially_paid` only when the payee is the patient (assumed on a non-assigned claim unless the 277 or EOB says otherwise); for a misdirected payment it fires when the provider confirms the refund. If misdirection is detected after a fee was charged, the fee is reversed automatically and fires again on refund confirmation. Fee = min(flat fee, 10% of amount recovered); first claim free; Autopilot subscribers pay no per-claim fee and the subscription pauses in months with no paid claim. Refund is a Stripe reversal recorded on the same `fee_events` row.

## 9. Shared primitives

Built once in the first slice that needs them, reused after.

| Primitive | Built in | Reused by |
|---|---|---|
| Provider action link (signed token, purpose, expiry, audit, PHI-free SMS) | 11 | 15, 19, 22, 24 |
| Letter engine (template → optional LLM polish → PDF → channel: fax, portal queue, mail) | 14 | 17, 22, 23 |
| Extraction harness and scorer (document schema in, per-field accuracy out) | 4 | 5, 16 |
| Job queue and timers | 10 | 13, 18, 29 |
| `validate(claim, payerRules)` | 8 | 25 |
| `claim_events` log | 10 | 21, 27, payer ETA statistics |

## 10. API and clients

- Services are the only write path. Server actions and `/api/v1/*` route handlers are thin transports over the same service functions; server components may call services for reads.
- `/api/v1`: JSON, zod-validated input and output, errors as `{ code, message }`. Session cookie auth now; bearer tokens added when the Expo client arrives.
- Anonymous first use: a photo creates a short-lived anonymous draft (extraction only). The eligibility call runs after email verification and consent, because it costs money, is the abuse vector, and sends data to a payer.
- UI: Tailwind 4 theme from the brand tokens, Bricolage Grotesque and Figtree, Lucide icons, 390-wide reference canvas, no dark mode. iOS web push works only after Add to Home Screen, so SMS and email carry notifications for most of the beta.

## 11. Error handling

- Illegal transitions are rejected, logged with the claim's correlation id, and alerted. State never changes outside `transition`.
- Vendor failures retry with backoff inside the job; after the last attempt the claim gets a staff-visible exception event and the patient sees nothing alarming unless action is needed.
- Extraction below confidence on a required field opens one patient task ("One quick thing") for that field only.
- A rejected 277CA maps to a known fix (auto-correct and resend) or to one patient task; unknown reasons go to a staff exception.
- Every user-facing error string follows the brand voice: no codes, no instructions without a reason, one ask at a time.

## 12. Testing

- `core`: exhaustive unit tests. Every legal transition, every illegal pair, timer math, fee math including the cap and first-claim-free, 837P mapping snapshots over the synthetic corpus with CLM07 = C and CLM08 = N asserted on every claim.
- `server`: integration tests against a real local Postgres 17, including tenant-isolation tests that prove one user cannot read another's rows through any repo.
- Integrations: contract tests replay `fixtures/`; `test` mode is exercised manually per slice once keys exist.
- Extraction: the scoring harness (slice 4) reports per-field accuracy against `corpus/**/labels.json`; the 95% gate is per field, not averaged.
- End to end: a Playwright walkthrough, photo to `accepted`, in fixture mode, from slice 12 on.
- Every slice ends with `test`, `typecheck` and `lint` green, then one commit.

## 13. Environments

| Env | Data | Stack |
|---|---|---|
| dev | synthetic only | local Postgres 17, local disk storage, local key, integrations in `fixture` or `test` |
| staging | synthetic and de-identified | AWS account A, same topology as prod |
| prod | real PHI, only after BAAs are signed | AWS account B: ECS Fargate (web, worker), RDS Postgres with PITR, S3, KMS, SES, Bedrock, CloudWatch |

Both AWS accounts sit in one Organization with the BAA accepted in AWS Artifact. Infrastructure is code from the first deploy. Deployment has no slice in the original sprint; `sprint-tasks.md` adds one in Week 2.

BAA inventory: AWS (database, storage, keys, LLM, email, compute), Stedi (click-through on upgrade), Twilio, Sinch. Not needed: Stripe (payment-processing exemption, no PHI sent), PostHog (marketing pages only). Error monitoring stays in CloudWatch until a vendor with a BAA is chosen.

## 14. Not building in Phase 1

Microservices, Kubernetes, multi-region, a message bus, GraphQL, a data warehouse, a native app, 835 ingestion, dark mode, the learned allowed-amount table, EHR integrations, calendar sync.

## 15. Open questions for humans

1. Attorney and Stedi support: on what legal basis does a one-tap provider authorization let a non-provider entity submit an 837P under that provider's NPI, and does Stedi's agreement permit it?
2. AWS: is SES inbound receiving covered by the BAA? AWS lists SES without restriction but does not address receiving explicitly.
3. Attorney: may a push notification body carry a dollar amount with no payer, provider, diagnosis or date? Default until answered: amounts allowed in push, nothing but a generic prompt in SMS.
4. Attorney: is a typed-name e-signature sufficient for the patient authorization and the provider authorization?
