# Slice 2 — Multi-user data model, scoped repos, service layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Written and executed in one session by the same author. Contracts (schema, signatures, tests) are spelled out in full; mechanical edits to existing pages are described, not reproduced.

**Goal:** Each person sees and changes only their own plans, claims, documents and follow-ups, and a claim can hold everything a CMS-1500 needs.

**Architecture:** Every domain row carries `user_id`. Repos in `src/server/db/repos/` are the only code that touches Drizzle for domain data, and every repo method takes `ctx: Ctx` first and filters on `ctx.userId`; there is no unscoped method to call by mistake. Services in `src/server/services/` compose repos with pure rules and are the only write path; server actions and `/api/v1` handlers are thin transports over them. ESLint fails the build when `src/app`, `src/ui` or `src/components` import Drizzle or `@/server/db`, and when `src/core` imports anything impure.

**Tech Stack:** Drizzle pg-core (`text` ids, `timestamptz`, `date`, `text[]`, `integer[]`), zod, vitest against `ferry_test`, ESLint `no-restricted-imports`.

## Global Constraints

- bun at `/opt/homebrew/bin`; `export PATH="/opt/homebrew/bin:$PATH"` first in a non-login shell.
- Synthetic data only. Both local databases are reset in this slice; nothing real exists to lose.
- Migrations are squashed to one file here because nothing has been deployed. From the first deploy (S21b) on, migrations are forward-only and never edited.
- Encryption is S2b. Do not seal columns here; do keep every PHI read and write inside a repo so S2b has one place to add it.
- The follow-up engine (`src/lib/followups.ts`) is deleted in S10. Decouple it from database row types; do not rewrite it.
- The 8-value `status` stays until S10.
- No visual redesign. New inputs use the MVP's classes.
- Branch `slice/s2-data-model`; one commit; fast-forward `main` when green (standing rule).

## Decisions made in this slice

| Decision | Why |
|---|---|
| `providers` rows belong to one patient (`user_id`). No `provider_links`, no shared provider table yet. | A provider record learned from one patient's superbill must never flow into another patient's claims: that is a privacy leak and a poisoning risk (wrong details entered for a real NPI). Three trust levels, three tables: what the patient told us (`providers`, now), what the registry says (`nppes_providers`, S6), what the provider controls (`provider_accounts`, S24). |
| Claims keep a snapshot of billing and rendering provider fields, plus optional links to `providers`. | A filed claim must stay reproducible as filed even if the provider record later changes. |
| Ids are prefixed ULIDs generated in the app. | Not guessable, sortable by creation time, and the prefix says what a bare id is in a log or URL. |
| The follow-up engine takes its own small input types in epoch seconds; services convert at the boundary. | Keeps a pure, tested module untouched two slices before it is deleted. |
| Service dates are Postgres `date` read as `YYYY-MM-DD` strings. | A date of service has no time zone; a timestamp would shift it across midnight. |

## Schema (the contract)

All tables below: `id text primary key`, `user_id text not null references users(id) on delete cascade`, timestamps `timestamptz`.

| Table | Prefix | Columns beyond id, user_id |
|---|---|---|
| `plans` | `pln_` | unchanged fields from S1; `subscriber_dob`, `patient_dob` become `date`; `created_at` |
| `providers` | `prv_` | `name`, `npi`, `tax_id`, `tax_id_type` (`EIN`/`SSN`), `address`, `phone`, `credential`, `license`, `created_at`, `updated_at`; unique `(user_id, npi)` |
| `claims` | `clm_` | `plan_id`; `status`; `billing_provider_id`, `rendering_provider_id` (nullable → providers); snapshot `billing_provider_{name,npi,tax_id,tax_id_type,address,phone}`, `rendering_provider_{name,npi,credential,license}`; `service_date_start`, `service_date_end` (`date`); `place_of_service`; `diagnosis_codes jsonb`; `total_charged`, `total_paid`, `amount_reimbursed` (cents); `extraction_notes`; `submitted_at`, `decision_at`; `submission_channel`, `confirmation_number`, `denial_reason`, `info_requested`; `created_at`, `updated_at` |
| `claim_lines` | `lin_` | `claim_id` (cascade); `position int`; `service_date date`; `cpt_code`; `modifiers text[]` with `CHECK (cardinality(modifiers) <= 4)`; `description`; `units int`; `charge int` (cents, line total); `diagnosis_pointers integer[]` default `{1}`; `place_of_service` |
| `documents` | `doc_` | `claim_id` (nullable, cascade); `kind` (`superbill`, `card_front`, `card_back`, `eob`, `letter`, `packet`); `storage_key`; `mime`; `bytes int`; `sha256`; `created_at` |
| `follow_ups` | `fup_` | `claim_id` (cascade); `type`; `due_at`; `status`; `draft_subject`; `draft_body`; `sent_at`; `created_at` |
| `events` | `evt_` | `claim_id` (cascade); `type`; `note`; `created_at` |

`claims.superbill_path` and `superbill_mime` are gone; the superbill is a `documents` row with `kind = 'superbill'`. Files live at `data/uploads/<user_id>/<doc_id><ext>`.

## File Structure

| File | Responsibility |
|---|---|
| `src/server/db/ids.ts` (create) | `newId(prefix)`, `ID_PREFIXES` |
| `src/server/db/schema.ts` (rewrite) | The tables above + re-export of the auth tables |
| `src/server/db/testing.ts` (modify) | add `createTestUser(email): Promise<Ctx>` |
| `src/server/db/repos/{plans,providers,claims,documents,follow-ups,events}.ts` (create) | Scoped data access; `claims` owns the claim + lines transaction |
| `src/server/db/repos/isolation.test.ts`, `claims.test.ts`, `schema.test.ts` (create) | Tenant isolation, line-model round trip, "every domain table has user_id" |
| `src/server/storage/local.ts` (create) | `putFile`, `getFile`, `deleteFile` under `data/uploads`; S2b wraps this |
| `src/server/services/{plans,claims,follow-ups,documents}.ts`, `types.ts` (create) | Use cases; the only write path; row types re-exported for the UI |
| `src/server/log.ts`, `log.test.ts` (create) | Allow-list JSON logger, `logFor(claimId)` |
| `src/core/api/claims.ts` (create) | zod DTOs: `ClaimSummarySchema`, `ClaimDetailSchema`, `ApiErrorSchema` |
| `src/app/api/v1/claims/route.ts`, `src/app/api/v1/claims/[id]/route.ts` (create) | Thin GET handlers |
| `src/lib/followups.ts`, `followups.test.ts`, `templates.ts`, `packet.ts` (modify) | Own input types; field renames; `Date` formatting |
| `src/lib/service.ts` (delete) | Replaced by services |
| `src/app/actions.ts`, pages, components (modify) | String ids, thin actions, modifiers and pointers inputs, rendering provider fields |
| `eslint.config.mjs`, `src/boundaries.test.ts` (modify/create) | Boundary rules, and a test that they bite |
| `drizzle/` (regenerate) | One squashed migration |

## Interfaces

```ts
// src/server/db/ids.ts
export const ID_PREFIXES = ["pln", "prv", "clm", "lin", "doc", "fup", "evt"] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];
export function newId(prefix: IdPrefix): string;            // "clm_01JABCDEFGHJKMNPQRSTVWXYZ0"

// every repo method: (ctx: Ctx, ...args). Reads return null / [] for rows that are not ctx.userId's.
plansRepo:      list(ctx) · get(ctx, id) · create(ctx, values)
providersRepo:  list(ctx) · get(ctx, id) · upsertByNpiOrName(ctx, values)
claimsRepo:     list(ctx) · get(ctx, id) · create(ctx, values, lines) · update(ctx, id, patch) · replaceLines(ctx, id, lines) · remove(ctx, id) · lines(ctx, claimId)
documentsRepo:  forClaim(ctx, claimId, kind?) · get(ctx, id) · create(ctx, values) · remove(ctx, id)
followUpsRepo:  forClaim(ctx, claimId) · open(ctx) · get(ctx, id) · createMany(ctx, claimId, items) · update(ctx, id, patch) · dismiss(ctx, ids)
eventsRepo:     forClaim(ctx, claimId) · append(ctx, claimId, type, note?)

// services: (ctx, ...) as well
plans:      listPlans · createPlan(ctx, PlanInput)
claims:     listClaims · getClaim(ctx, id): ClaimView | null · createClaimFromUpload(ctx, { planId, file? }) · saveClaim(ctx, id, ClaimInput)
            · markSubmitted · recordOutcome · markAppealed · closeClaim · deleteClaim
follow-ups: generateDraft(ctx, id) · updateFollowUp(ctx, id, { action, subject?, body? })
documents:  getSuperbill(ctx, claimId) · buildClaimPacket(ctx, claimId)

// src/server/log.ts
export function log(event: string, fields?: Record<string, unknown>): void;   // drops every key not on the allow-list
export function logFor(claimId: string): (event: string, fields?: Record<string, unknown>) => void;  // adds cid
```

---

### Task 1: Ids, schema, squashed migration, test users

- [x] Write `ids.test.ts` first: prefix + `_` + 26 Crockford base32 chars; 10,000 ids are unique; ids created 2 ms apart sort in creation order; an unknown prefix is a type error and a runtime throw. Run: FAIL (module missing). Implement `ids.ts`. PASS.
- [x] Write `schema.test.ts` first: every table in `public` except `users`, `sessions`, `accounts`, `verifications`, `passkeys` has a `user_id` column that is `NOT NULL` with a foreign key to `users` (query `information_schema`). Run: FAIL on the old tables.
- [x] Rewrite `schema.ts` per the contract. `rm -rf drizzle && bun run db:generate`. Reset both local databases (`DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;`) and migrate. `schema.test.ts` PASSES.
- [x] Add `createTestUser(email)` to `testing.ts`; it inserts a `users` row and returns `{ userId, role: "patient" }`.

### Task 2: Scoped repos, proven by isolation tests

- [x] Write `isolation.test.ts` first. For users A and B: A creates a plan, provider, claim with lines, document, follow-up and event. As B: every `get` returns `null`, every list returns `[]`, every `update`/`remove`/`dismiss`/`replaceLines` changes nothing, and `create` of a claim or document pointing at A's plan or claim throws. As A afterwards: everything is still there and unchanged. Run: FAIL.
- [x] Write `claims.test.ts` first: a claim with two lines, 3 units, modifiers `95` + `59`, per-line pointers `[1]` and `[1, 2]` round-trips unchanged and in order; five modifiers are rejected by the database; deleting the claim deletes its lines, documents, follow-ups and events.
- [x] Implement the six repos. Both test files PASS.

### Task 3: Follow-up engine off database types

- [x] In `src/lib/followups.ts` replace the `Claim`, `Plan`, `FollowUp` imports with local input types (`FollowUpClaim`, `FollowUpPlan`, `ExistingFollowUp`, all times in epoch seconds, ids as strings). Logic unchanged. Update the fixtures' casts in `followups.test.ts`; assertions unchanged. The 7 tests PASS.

### Task 4: Storage, services, thin actions, pages

- [x] `src/server/storage/local.ts`.
- [x] Services per the interfaces. `getClaim` returns `ClaimView = { claim, plan, lines, followUps, events, superbill: Document | null, deadlines: { timelyFiling: Date | null; appeal: Date | null } }`. `saveClaim` validates with zod (CPT 5 chars, ≤ 4 two-character modifiers, pointers 1–12 that reference a listed diagnosis, dates `YYYY-MM-DD`), upserts the billing provider (and the rendering one when it differs), replaces lines in one transaction, then reconciles follow-ups. `deleteClaim` also deletes the claim's files.
- [x] Write `services/claims.test.ts` first for: save + reconcile creates the timely-filing follow-up; `markSubmitted` schedules +14/+30/+45 days and dismisses the stale warning; a pointer to a diagnosis that is not listed is rejected; user B cannot save, submit or delete user A's claim.
- [x] `src/app/actions.ts`: each action is `requireCtx` → parse `FormData` → one service call → revalidate/redirect. Delete `src/lib/service.ts`.
- [x] Pages, routes and components: string ids; types from `@/server/services/types`; `fmtDate`/`relative` take `Date`; line editor gains a modifiers field (up to four, space separated) and a Dx pointers field; edit page gains rendering-provider name, NPI and credential; superbill preview keys off the `documents` row.
- [x] `templates.ts`, `packet.ts`: billing-provider field names, `modifiers.join(" ")`, `Date` formatting; packet shows the rendering provider when present.

### Task 5: `/api/v1/claims`

- [x] `src/core/api/claims.ts` zod DTOs (dates as ISO strings, money in cents). Test first: `toClaimSummary`/`toClaimDetail` output parses; a row with an unexpected shape fails parsing rather than leaking.
- [x] `GET /api/v1/claims` → `{ claims: ClaimSummary[] }`; `GET /api/v1/claims/[id]` → `ClaimDetail` or `404 { code: "not_found", message }`; no session → `401 { code: "unauthorized", message }`.

### Task 6: Logger

- [x] Write `log.test.ts` first: log a full plan and claim; the captured line contains none of the seeded name, member ID, diagnosis, Tax ID or address; allow-listed ids and the event name are present; `logFor(claimId)` adds `cid`; an `Error` contributes only its name. Implement `log.ts`.

### Task 7: Boundaries

- [x] Write `src/boundaries.test.ts` first: run ESLint programmatically on snippets and expect an error for `src/app/x.tsx` importing `drizzle-orm`, for `src/components/x.tsx` importing `@/server/db/schema`, for `src/core/x.ts` importing `next/headers` and `@/server/db`; expect no error for `src/app/x.tsx` importing `@/server/services/claims`. Run: FAIL. Add the rules to `eslint.config.mjs`. PASS, and `bun run lint` is clean on the real tree.

### Task 8: Two-user walkthrough, docs, commit, merge

- [x] On `bun run dev`: sign in as A, add a plan, upload `corpus/synthetic/superbills/sb-06.pdf`, enter two lines (one with modifiers `HO 95`, pointers `1`), a rendering provider, save, packet PDF, mark submitted. Sign out. Sign in as B: empty dashboard, empty plans; A's claim URL, packet URL, superbill URL and `/api/v1/claims/<A's id>` all return not-found; `/api/v1/claims` returns `[]`. Back as A: everything intact; `/api/v1/claims` lists one claim.
- [x] Update `docs/architecture.md` §5 (providers decision), `docs/sprint-tasks.md` (tick S2; amend its Produces line), `CLAUDE.md` (migrations are forward-only after first deploy), README layout.
- [x] `bun run test && bun run typecheck && bun run lint`; commit; fast-forward `main`; re-run; delete the branch.

## Execution notes (2026-09-17)

- A mutation check (owner filter removed from `claimsRepo.get`) made `isolation.test.ts` fail, so the suite is known to bite.
- `NotOwnedError` moved to `src/server/errors.ts` so pages never import from `db/`.
- Found in the browser walkthrough, each reproduced by a test before the fix:
  - The form had no per-line place of service, so a mixed office/telehealth superbill could not be entered. Added `li_pos`.
  - The filing deadline showed a day early in US time zones because dates of service were anchored at midnight UTC. Anchored at noon UTC; a test checks six US zones. Pre-existing in the MVP.
  - Moving a date of service left the old pending warning and added a second. Reconciliation now dismisses a pending follow-up that is re-proposed with a new due date. Pre-existing in the MVP.
- `silent: "passed-only"` in vitest keeps the new structured logs out of passing test output.
