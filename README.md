# Superbill Claims

Web app that turns a superbill into an insurer-ready claim packet, tracks the claim, and auto-schedules the follow-ups (status inquiries, escalations, info responses, appeals) that get out-of-network reimbursement paid.

## Run it

```sh
bun install
cp .env.example .env      # add ANTHROPIC_API_KEY for AI extraction + tailored letters
bun run dev               # http://localhost:3000
```

Without an API key everything still works: you type the codes in yourself and follow-up letters come from built-in templates.

## Flow

1. **Insurance plans** — enter the card details and where claims go (portal / fax / mail). Once per plan.
2. **New claim** — upload the superbill (photo or PDF). Claude reads provider, NPI, Tax ID, CPT/ICD-10 codes, charges. You review and correct.
3. **Claim packet (PDF)** — cover letter + out-of-network claim form + the superbill, ready to upload to the portal or fax.
4. **Mark submitted** — follow-ups are scheduled: status inquiry at 14 days, escalation at 30, regulator-complaint notice at 45.
5. **Record the insurer's response** — acknowledged / paid / denied / info requested. Denials open an appeal task (180-day window); info requests open a response task. Stale follow-ups are dismissed automatically.
6. **Generate draft** on any follow-up → edit → copy / open in email → mark sent. The dashboard shows what's due this week.

Timing rules live in `src/lib/followups.ts` (`RULES`) and are unit-tested (`bun run test`).

## Layout

```
src/db/           drizzle schema + libsql (SQLite at ./data/app.db, migrations in ./drizzle)
src/lib/ai.ts     Claude calls: superbill extraction (vision) and letter drafting
src/lib/followups.ts   pure rules engine: which follow-ups exist for a claim state
src/lib/templates.ts   cover letter + fallback letter templates
src/lib/packet.ts      PDF packet (pdf-lib)
src/app/actions.ts     server actions (all writes)
src/app/...            dashboard, plans, claims/new, claims/[id], claims/[id]/edit
```

Uploaded superbills and the database live in `./data` (gitignored) — that's PHI, keep it local.

## Scripts

`bun run dev` · `bun run build` · `bun run test` · `bun run typecheck` · `bun run lint` · `bun run db:generate` (after schema changes)
