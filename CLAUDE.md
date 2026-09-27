# CLAUDE.md

Context for Claude Code sessions in this repo.

## What this is

Ferry (working name) is a membership for out-of-network therapists and psychiatrists:
- An AI scribe: the clinician records the session, dictates or types.
- Notes in SOAP, DAP, BIRP or intake format, with suggested CPT and ICD-10 codes.
- Medical-necessity and appeal letters drafted from the clinician's own progress notes.
- Every client's out-of-network claim filed and chased for free.

Clinicians start with a 7-day trial and no card, then pay one monthly membership. Clients never pay. `docs/prd.md` is the product source of truth. Launch specialty: psychotherapy + psychiatry.

This repo is the whole product: a Next.js 16 web app (installable on phones with mic and camera in the browser; desktop for clinicians), its API, a job worker and a capture relay. Expo store apps are P1; do not build one now.

## Read before non-trivial work

1. `docs/prd.md` and `docs/spec.html`: the product and its screens. They win on product questions, except where a 'PRD changes awaiting D2' item in `docs/sprint-tasks.md` applies: there the Product invariants below win until Ryan answers D2 (for example, clients never see a letter's text or PDF).
2. `docs/architecture.md` — the design. Wins on technical questions.
3. `docs/sprint-tasks.md` — every slice: scope, interfaces, acceptance criteria, what is blocked on the founder.
4. `FERRY_BRAND.md` — before touching any UI, copy, or theme code. Section 12 amends the earlier sections.
5. `docs/mentaya-teardown-and-product-framework.md` — product intent; §3.4 is the state table.
6. `docs/60-day-sprint.md` — schedule and gates. `docs/reference/` holds vendor evaluation, pricing, market and competitor docs.

## Product invariants (never violate)

**Payee and money**
- The client is the payee. Claims file under the member clinician's NPI with Accept Assignment = No: CLM07 = C, CLM08 = N, Box 13 blank, on every 837P (original, corrected and cancel) and every member-form packet. We never take assignment, never hold money, never float.
- Clients never pay Ferry, and nothing is priced per claim, in code or copy. Clinicians pay one membership; its price and trial length live only in `PRICING` (`src/core/billing`).
- Access follows the pure `entitlementsFor()`. Trial or active is full access. No card after the trial, or a lapse after cancellation, is read-only:
  - nothing is deleted
  - claims already filed are chased to closure, and the clinician can still draft, approve and send letters for them
  - notes stay exportable for 30 days after cancellation

**Who sees what**
- The clinician is the tenant: every row about a client's care has `user_id` = that clinician.
- A client reaches only their own client record, plans, client consents, claims (no diagnosis by default), timeline and a list of letters sent (kind, insurer, date), through a `ClientCtx` that only `clientCtxFor()` builds from an active membership. Clients never see a letter's text, PDF or attachments.
- Roles (`pending`, `clinician`, `client`, `staff`) are set on the server by path (Start free, invite acceptance, `staff:grant`), never from request input.
- `acceptInvite` binds only a user whose verified email (or SMS-verified phone) matches the contact the clinician entered. It never changes a clinician's or staff user's role.
- Clinician-only data: notes, transcripts, captures, letters, clinician profiles and consents, fees, eligibility payloads, model call logs, notifications and subscriptions. Those repos accept only `ClinicianCtx | SystemCtx`, refusing a `ClientCtx` at compile time and at run time. Client DTOs in `src/core/api/trips.ts` have no note, letter-body, diagnosis or Tax ID field (marker test).
- Staff use `StaffCtx`: cross-tenant ids, kinds, ages and counts only, and act on a task only through the audited `staffActFor`. Staff never download PHI documents.

**Approval and consent**
- Nothing reaches an insurer without the clinician's approval: no claim before Approve note, no letter before Approve letter. The only automatic insurer traffic:
  - 270 eligibility checks (only after the client's filing consent and the clinician's filing authorization; no clinical content)
  - 276 status checks
  - corrected resubmissions of an approved claim that change no CPT, ICD-10, modifier, units, charge, date of service or pointer
- 'Copy note' works only after Approve.
- Recording needs the client's current recording consent. Filing needs the client's current filing consent and the clinician's signed filing authorization.
- Withdrawal:
  - Recording consent withdrawn: an active recording ends within 5 seconds.
  - Filing consent withdrawn: claims still in draft or ready are canceled; claims already sent continue to closure; no void is sent automatically.
- A consent to an older version of a legal text is stale, and gates refuse until re-consent. A signer for a client under 18 must be a parent or guardian.
- Live submission, live recording, real letters and prod onboarding stay refused while any required legal text is still a placeholder (`assertLiveLegal`).

**Audio, transcripts and scans**
- Ferry never stores session audio. It streams phone → capture relay → AWS HealthScribe (recording) or Amazon Transcribe Medical (dictation, capped at 5 minutes), and is never written to disk, S3, logs or the database. HealthScribe's S3 output is deleted on import.
- Transcripts, dictation text and typed rough notes are erased 24 hours after creation, whether or not the note is approved:
  - each is sealed under its own key, kept outside Postgres so backups can't restore it
  - erasure destroys that key (keyed timer, 15-minute sweeper with a lag alert, S3 lifecycle backstop)
  - reads refuse an expired one
  - approved notes, letters and claims are the record and are kept
- No side copies:
  - model call logs (`external_calls`) keep only hashes, sizes, timing and status for model calls, never inputs or outputs
  - job payloads are ids only, and job failures record only the error name
  - note evidence stores transcript segment ids, never text
  - 'use cache' and unstable_cache are banned on PHI paths
- Scan photos (insurance cards, insurer letters, EOBs) are read in memory and never stored: no file, no Storage object, no image in any log. Extracted fields are sealed under a 24-hour key until the person confirms, then cleared; only the image hash and confirmed fields remain. The app never writes a photo to the phone's library.

**Letters**
- Letters are drafted only from the same client's approved progress notes, never psychotherapy notes, and cite the note lines they use. Nothing is invented; unknowns stay in [brackets]. The Tax ID is added when the PDF is rendered, never in a draft or prompt.
- Letters an insurer asked for go by fax or clinician-mailed paper, never 'electronic'.

**PHI handling**
- No BAA on the stack → no real PHI. `FERRY_DATA_CLASS` is `synthetic | deidentified | real`; `real` is refused while `bun run preflight:real-data` fails.
- Production runs in the `prelaunch` tier until Gate E passes, then admits only the beta allow-list until open sign-up.
- PHI goes to Claude only via AWS Bedrock in us-east-1, with model-invocation logging off (checked at boot in every process). The direct Anthropic API is for synthetic data only, and only in the dev tier.
- Client data is never used for model training: Bedrock doesn't train on inputs, and the AWS Organization carries an AI services opt-out policy covering all services (stack test and preflight line).
- No PHI in SMS, emails, invite bodies, logs, Stripe metadata or descriptions, analytics, error output or Bedrock logs:
  - every SMS and email template goes through the send wrapper, where `assertNoPhi` rejects names, payer, codes, dates, amounts and care-revealing words
  - push may carry a dollar amount and nothing else identifying
  - unhandled errors print only the error name, in every process
- A clinician Tax ID may be an SSN: always sealed, shown only as the last four, never logged, and never in any LLM input (the LLM wrapper refuses it).

**Claim engine and copy**
- Exactly one `notify` effect per applied state change, produced only by `transition()`. It names its recipients: the client, and the clinician only when a task is assigned to them. Each recipient gets at most one message for it (unique on claim event + recipient).
- Copy never claims what we can't observe:
  - `paid` means the payer reported payment ("On its way")
  - "It landed" fires only on the client's confirmation
  - a member-form claim stays `ready` until the clinician marks it mailed or a fax confirms
- Scope: commercial PPO/POS/HDHP + Medicare Advantage PPO. Original Medicare, Medicaid and HMO are gated out at insurance entry or card scan.
- Claim model is a full CMS-1500 (multiple lines, units, up to 4 modifiers, add-on codes, diagnosis pointers, POS 02/10), not a therapy form.

**Naming**
- The word in code is `claim`; "Trip" is client UI copy only.
- A therapy session is an `encounter` in code (Better Auth owns `sessions`); "session" is UI copy.
- "Ferry" lives in one brand constant.

## Claim state machine

16 states: `draft` `ready` `submitted` `accepted` `rejected_front_end` `in_adjudication` `info_requested` `stalled` `escalated` `applied_to_deductible` `partially_paid` `paid` `denied` `appealed` `misdirected` `closed`. Older docs say 14; the table is right. State changes happen only through the pure `transition()` in `src/core/claim`; it returns effects that the worker executes. Every transition appends to `claim_events` in the same transaction. Timers are payer-parameterized. Copy, engine action and timer for each state live in one definition record.

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4
- Postgres 17 + Drizzle; pg-boss for jobs; Better Auth (magic link + passkeys)
- Everything that touches client data runs in AWS us-east-1.
- Claude via Bedrock (`us.anthropic.claude-sonnet-5`). This model has no structured outputs on Bedrock, so every schema-bound call is a forced tool call validated with zod and retried once.
- AWS HealthScribe streaming for recorded sessions; Amazon Transcribe Medical streaming for dictation.
- Stedi (270/271, 837P, 277CA, 276/277); Sinch fax; SES email; Stripe Billing.
- SMS through Twilio or AWS End User Messaging; optional at launch, since email carries every message until an SMS BAA and A2P land.
- The capture relay is a separate process on the `ws` package (`bun run relay`); the worker runs pg-boss (`bun run worker`).
- bun for packages, `bunx` not `npx`. bun lives at `/opt/homebrew/bin`; add it to PATH in non-login shells.
- vitest; Playwright (added in N1) for the end-to-end walkthroughs behind Gates C, D and E2

## Commands

```sh
bun install
bun run dev          # http://localhost:3000 (runs build:sw first)
bun run build:sw     # bundle src/pwa/sw.ts → public/sw.js and capture worklets → public/worklets/
bun run test         # vitest
bun run typecheck    # next typegen && tsc --noEmit
bun run lint
bun run db:generate  # after schema changes
bun run db:migrate   # apply to ferry_dev (db:migrate:test for ferry_test)
```

## Boundaries (lint-enforced from slice 2)

- `src/core/**`: pure domain. Imports only `zod`, `date-fns`, and other `src/core` modules. No I/O, no Next, no Drizzle.
- `src/app/**`, `src/ui/**`: never import `drizzle-orm` or `@/server/db/**`. Go through `@/server/services`.
- `src/server/services/**` is the only write path. Server actions and `/api/v1` route handlers are thin transports over it.
- Only `src/server/db/repos/**` sees ciphertext. Every repo method takes a `Ctx` (`ClinicianCtx | ClientCtx | SystemCtx`) first and filters through `tenantWhere(table, ctx)`; `ctx.userId` is always the tenant clinician.
- `systemCtx()` is importable only from `src/server/jobs/**`, `src/server/relay/**`, `src/app/api/webhooks/**` and `src/server/services/ops.ts`. `inviteCtx()` is importable only from `src/server/services/invites.ts`.
- Lookups without a ctx live only in `repos/resolvers.ts` and return ids only.
- Contexts come only from guards and constructors: lint flags a literal `scope: "clinician" | "self" | "client" | "invite" | "system" | "staff"` or a cast to a ctx type outside `src/server/auth/**`, `services/invites.ts` and `db/testing.ts`.
- Roles change only through `services/roles.ts` (`setRoleOnServer`, compare-and-set from `pending`; `grantStaff`), importable only from `scripts/ops/**`, `services/invites.ts` and `services/clinician.ts`. `repos/users.ts` (auth-owned, no ctx) is importable only from `services/roles.ts` and `services/invites.ts`; `@/server/db/testing` only from tests.
- Work a client triggers in the clinician's tenant (eligibility, filing waiting claims) is enqueued as a job with the tenant id, never run in the client's request.
- Integrations each expose an interface with `live`, `test` and `fixture` implementations, chosen by `modeFor(vendor)` (`FERRY_<VENDOR>_MODE`, which can also be `off`). Dev defaults to `fixture`.
- `FERRY_DEPLOY_TIER` (`dev | prelaunch | staging | prod`) decides which modes may boot:
  - prelaunch: all off
  - staging: live, test or off; never fixture or local
  - prod: live, with off only for sms and fax
- Every entrypoint (Next, worker, relay) calls `bootProcess()` first.

## Conventions

- One slice per session, from `docs/sprint-tasks.md`, in its execution order. Write the slice's step plan to `docs/plans/` first if the slice is more than a few files.
- Test first for anything touching the state machine, timers, entitlements, 837P mapping, tenancy or the access model, encryption, consent gating or transcript erasure.
- Each slice gets its own branch (`slice/s<id>-<name>`) off `main`. End it with `bun run test`, `typecheck` and `lint` green, plus `bun run test:e2e` for any slice with e2e acceptance; tick the slice in `docs/sprint-tasks.md`, make one commit, then fast-forward `main`, re-run the checks on `main`, and delete the merged branch. This is a standing rule (2026-09-17): do not ask each time. Never push, force-push, reset --hard or delete an unmerged branch without asking.
- Move MVP files into the new layout only in the slice that touches them (table in architecture §3).
- Every repo method takes `ctx` first and filters through `tenantWhere`.
- Every new table gets `user_id NOT NULL`: the clinician tenant, or the user for auth-owned rows and `client_memberships`. A test fails otherwise.
  - Client-scoped tables also get `client_id NOT NULL` and go on `CLIENT_SCOPED`; the only exceptions are listed, with a CHECK.
  - `clients` is `CLIENT_SELF`.
  - Reference tables with no owner go on `GLOBAL_TABLES`.
- Every text, jsonb or bytea column is listed as `SEALED`, `EPHEMERAL` or `PLAINTEXT_OK` in `src/server/db/columns.ts`; a test fails otherwise.
- Services throw `NotOwnedError`; actions and routes turn it into a 404.
- Server code reads time from `clock.now()`. Timers are rows in the `timers` table fired by the tick job, never pg-boss `startAfter`.
- Dev-only scripts call `assertDevTier()`.
- `/api/v1` responses are built field by field and parsed through a strict zod schema in `src/core/api` on the way out. Never spread a database row into a response.
- Log with `log()` / `logFor(claimId)` from `@/server/log`. It drops anything not on its allow-list; add a key there only if it can never hold PHI.
- Migrations were squashed on 2026-09-17 because nothing was deployed. From the first deploy on they are forward-only: never edit or delete one.
- Read files before editing. Targeted edits over rewrites. No comments unless the logic is non-obvious. No docstrings, no speculative abstractions, no backwards-compat shims.
- Never type, paste or echo API keys. The founder puts them in `.env.local`; code reads them from env.
- After a correction from the founder, add the lesson to `tasks/lessons.md`.
- After Day 28 (Oct 18): no new features unless a beta clinician, a payer rejection or a launch blocker asks for it. The post-freeze P0 slices already scheduled (letters, insurer mail, notifications, hardening) are the exception, and are proven by Gate E2.

## Decisions log

- 2026-09-17: Stedi primary clearinghouse, Claim.MD backup. Psychotherapy + psychiatry at launch; PT + chiro phase 2. Autopilot ships v1. Practice Sponsor tiered by accepted claims (Basic $0 / Starter $59 / Growth $149 / Group $399). Product name open. Fee figures are placeholders ($9 pay-when-paid, $15 Autopilot) held in config.
- 2026-09-17: Web-first Next.js PWA with an API-ready backend; Expo deferred. Supersedes the Cowork scaffold's "Expo" note. Full list D1–D15 in `docs/architecture.md`.
- 2026-09-17: Merge each green slice to `main` locally without asking. No git remote yet by the founder's choice; the repo exists only on this Mac (open risk R1 in `docs/sprint-tasks.md`).
- 2026-09-17: Ferry uses only `FERRY_BRAND.md` for visuals. Three chips added (On its way, Counted, Closed).
- 2026-09-27: Pivot to a clinician membership; `docs/prd.md` wins over older docs.
  - Pricing: clinicians pay about $50/month (placeholder, D1) after a 7-day no-card trial. Clients never pay.
  - Deleted: the $9 pay-when-paid plan, per-claim fees, Autopilot and the Practice Sponsor tiers; this supersedes those parts of the 2026-09-17 entry.
  - Tenancy: the clinician is the tenant; clients read their own claims through a membership, never notes or letter bodies.
  - Phone: the installable web app at launch; Expo store apps are P1.
  - Slices:
    - replaced: S11 and S24 → N5 (clinician account) and N7a/N7b (clients and invite); S11b and S20 → N6 (membership billing)
    - dropped: S19 and the portal-queue letter route
    - merged: S15 → N15; S21 → S29; S25 → N9a/N9b, S8 and S6b; S30 → S3b and S11c
    - S4 keeps only the LLM provider and scorer; superbill extraction moves to P1, with S22
    - to P2: S23, S26 and S27
  - Dates: feature freeze moves from Oct 11 to Oct 18; M1 Oct 9; M2 Oct 11; letters, notifications, deploy and hardening run Oct 19–29, with Gate E2 on Oct 29; beta Nov 2–15; launch Nov 17.
  - Build order: docs and safety rails, the phone spike (Sep 29), the access model, foundations, a thin fixture path end to end, voice, depth, buffer. Gates A, B, C, D, E2 and E are in `docs/sprint-tasks.md`.
- 2026-09-27: AWS HealthScribe streaming is the scribe; the whole PHI stack runs in us-east-1 (architecture D8).
  - Audio: browser audio is 16 kHz PCM from an AudioWorklet (HealthScribe streaming doesn't accept MediaRecorder's WebM/MP4). It goes over a WebSocket to the relay process, which holds the HTTP/2 stream.
  - Division of work: HealthScribe writes the note from recordings. Dictation goes through Amazon Transcribe Medical (transcript only). Claude on Bedrock writes the codes, and the notes from dictation and typing.
- 2026-09-27: Transcripts, dictation text and typed rough notes are erased at 24 hours.
  - Keys: each is sealed under its own key in an EphemeralKeyStore outside Postgres (DynamoDB with point-in-time recovery and backups off in production), so RDS backups hold only ciphertext.
  - Storage settings: the HealthScribe output bucket has versioning off and a 1-day lifecycle rule.
  - Side copies: model call logs keep hashes only, job payloads are ids only, note evidence is segment ids, and scan fields use the same 24-hour keys.
- 2026-09-27: Plan review fixes.
  - Deploy tiers separate from NODE_ENV; every process boots through `bootProcess()`.
  - Timers use a table and a shared dev clock.
  - Invites are bound to the entered contact.
  - Clients see letter metadata only.
  - 270 eligibility is the one added automatic insurer contact.
  - Copy note works after Approve.
  - Filing-consent withdrawal cancels only unsent claims.
  - Read-only clinicians keep answering letters on filed claims.
  - The AI services opt-out policy is required before real data.
  - The 12 PRD wording changes await Ryan's D2 answer before `docs/prd.md` is edited.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
