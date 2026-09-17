# CLAUDE.md

Context for Claude Code sessions in this repo.

## What this is

Ferry (working name) is a patient-first out-of-network claims product: photograph a superbill, we file it electronically, chase it until it's paid, and show every step. Flat fee only when money comes back. Launch specialty: psychotherapy + psychiatry, with psychological testing codes supported.

This repo is the whole product: a Next.js 16 web app (responsive PWA), its API, and a job worker. An Expo client may attach to the API later; do not build one now.

## Read before non-trivial work

1. `docs/architecture.md` — the design. Wins on technical questions.
2. `docs/sprint-tasks.md` — every slice: scope, interfaces, acceptance criteria, what is blocked on the founder.
3. `FERRY_BRAND.md` — before touching any UI, copy, or theme code. Section 12 amends the earlier sections.
4. `docs/mentaya-teardown-and-product-framework.md` — product intent; §3.4 is the state table.
5. `docs/60-day-sprint.md` — schedule and gates. `docs/reference/` holds vendor evaluation, pricing, market and competitor docs.

## Product invariants (never violate)

- Patient is the payee. Claims file under the rendering provider's NPI with Accept Assignment = No: CLM07 = C, CLM08 = N, Box 13 blank. We never take assignment, never hold money, never float.
- Fee fires only on `paid` / `partially_paid` with the patient as payee. Deductible-only and denied claims cost $0. Fee is capped at 10% of amount recovered. A fee charged before a misdirected payment is discovered is reversed automatically.
- No BAA on the stack → no real PHI. Synthetic or de-identified data only. Not for a day, not for one friend.
- PHI goes to Claude only via AWS Bedrock. The direct Anthropic API is for synthetic data only and must refuse to run otherwise.
- No PHI in SMS bodies, logs, Stripe metadata or descriptions, PostHog, or error reports. Push may carry a dollar amount and nothing else identifying.
- A provider Tax ID may be an SSN: always sealed, masked to the last four in UI, never logged.
- Exactly one notification per state change, produced only by `transition`.
- Copy never claims what we can't observe. `paid` means the payer reported payment ("On its way"). "It landed" fires only on patient confirmation.
- Scope: commercial PPO/POS/HDHP + Medicare Advantage PPO. Original Medicare, Medicaid, HMO gated out at intake.
- Claim model is a full CMS-1500 (multiple lines, units, up to 4 modifiers, add-on codes, diagnosis pointers, POS 02/10), not a therapy form.
- The word in code is `claim`. "Trip" is UI copy only. "Ferry" lives in one brand constant.

## Claim state machine

16 states: `draft` `ready` `submitted` `accepted` `rejected_front_end` `in_adjudication` `info_requested` `stalled` `escalated` `applied_to_deductible` `partially_paid` `paid` `denied` `appealed` `misdirected` `closed`. Older docs say 14; the table is right. State changes happen only through the pure `transition()` in `src/core/claim`; it returns effects that the worker executes. Every transition appends to `claim_events` in the same transaction. Timers are payer-parameterized. Copy, engine action and timer for each state live in one definition record.

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4
- Postgres 17 + Drizzle; pg-boss for jobs; Better Auth (magic link + passkeys)
- Claude via Bedrock (`us.anthropic.claude-sonnet-5`); Stedi (270/271, 837P, 277CA, 276/277); Twilio SMS; Sinch fax; SES email; Stripe
- bun for packages, `bunx` not `npx`. bun lives at `/opt/homebrew/bin`; add it to PATH in non-login shells.
- vitest; Playwright for the end-to-end walkthrough from slice 12

## Commands

```sh
bun install
bun run dev          # http://localhost:3000
bun run test         # vitest
bun run typecheck    # next typegen && tsc --noEmit
bun run lint
bun run db:generate  # after schema changes
```

## Boundaries (lint-enforced from slice 2)

- `src/core/**`: pure domain. Imports only `zod`, `date-fns`, and other `src/core` modules. No I/O, no Next, no Drizzle.
- `src/app/**`, `src/ui/**`: never import `drizzle-orm` or `@/server/db/**`. Go through `@/server/services`.
- `src/server/services/**` is the only write path. Server actions and `/api/v1` route handlers are thin transports over it.
- Only `src/server/db/repos/**` sees ciphertext. Every repo method takes a `Ctx { userId, role }`.
- Integrations each expose an interface with `live`, `test` and `fixture` implementations. Dev defaults to `fixture`.

## Conventions

- One slice per session, from `docs/sprint-tasks.md`, in its execution order. Write the slice's step plan to `docs/plans/` first if the slice is more than a few files.
- Test first for anything touching the state machine, timers, fee logic, 837P mapping, tenancy or encryption.
- End every slice with test, typecheck and lint green, tick the slice in `docs/sprint-tasks.md`, then make one local commit. Never push, force-push, reset --hard or delete branches without asking.
- Move MVP files into the new layout only in the slice that touches them (table in architecture §3).
- Read files before editing. Targeted edits over rewrites. No comments unless the logic is non-obvious. No docstrings, no speculative abstractions, no backwards-compat shims.
- Never type, paste or echo API keys. The founder puts them in `.env.local`; code reads them from env.
- After a correction from the founder, add the lesson to `tasks/lessons.md`.
- After Day 21 (Oct 11): no new features unless a beta patient, payer rejection, or launch blocker asks for it.

## Decisions log

- 2026-09-17: Stedi primary clearinghouse, Claim.MD backup. Psychotherapy + psychiatry at launch; PT + chiro phase 2. Autopilot ships v1. Practice Sponsor tiered by accepted claims (Basic $0 / Starter $59 / Growth $149 / Group $399). Product name open. Fee figures are placeholders ($9 pay-when-paid, $15 Autopilot) held in config.
- 2026-09-17: Web-first Next.js PWA with an API-ready backend; Expo deferred. Supersedes the Cowork scaffold's "Expo" note. Full list D1–D15 in `docs/architecture.md`.
- 2026-09-17: Ferry uses only `FERRY_BRAND.md` for visuals. Three chips added (On its way, Counted, Closed).
