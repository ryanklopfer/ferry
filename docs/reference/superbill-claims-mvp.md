# Superbill Claims — MVP status (2026-09-06)

Working web MVP lives at `~/Desktop/superbill-claims` on Ryan's Mac (Next.js 16, TypeScript, Tailwind 4, Drizzle + libsql/SQLite, Anthropic SDK, pdf-lib, vitest). Run: `bun install && cp .env.example .env && bun run dev`.

## What it does
- Insurance plan setup (card details, claims address/fax/portal, timely-filing days).
- Upload superbill (image/PDF) → Claude vision extracts provider/NPI/Tax ID/CPT/ICD-10/charges → review/edit form.
- Claim packet PDF: cover letter + out-of-network claim form + superbill attached.
- Status lifecycle: draft → submitted → acknowledged → paid | denied → appealed | info_requested → closed.
- Follow-up engine (`src/lib/followups.ts`, unit-tested): timely-filing warning (30d before), status inquiry (+14d), escalation (+30d), regulator notice (+45d), appeal on denial (180d window), info response. Stale follow-ups auto-dismissed on status change.
- Follow-up letters drafted by Claude (template fallback without API key), editable, copy / mailto, mark sent. Dashboard shows what's due this week.

## Not yet done / next ideas
- Live Claude extraction was not exercised (no API key in build sandbox); prompt + parser are unit-tested.
- No auth / multi-user — single local user, PHI stored in `./data`.
- No actual sending (fax/portal APIs); user submits manually and records it.
- Possible next: e-fax integration (e.g. via an API fax provider), email reminders, insurer address directory, CMS-1500 field mapping, multi-patient practice mode.
