# Superbill Claims

Web app that turns a superbill into an insurer-ready claim packet, tracks the claim, and auto-schedules the follow-ups (status inquiries, escalations, info responses, appeals) that get out-of-network reimbursement paid.

## Run it

```sh
brew install postgresql@17 && brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/createdb ferry_dev
/opt/homebrew/opt/postgresql@17/bin/createdb ferry_test
bun install
cp .env.example .env.local   # DATABASE_URL
printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" >> .env.local
bun run db:migrate
bun run dev                  # http://localhost:3000
```

Sign in at `/sign-in` with any email address. In development nothing is actually emailed: the sign-in link is printed in the dev server log and saved to `data/outbox/`. Links work once and last 15 minutes. Add a passkey on `/account` to skip the email next time.

## What runs today

The patient MVP (plans, superbill upload, claim pages) was removed in N2b. What is left: the public pages (`/`, `/start`, `/for-clients`, `/legal/*`, `/i/*`), sign-in, `/account`, and placeholder homes for each role (`/app` clinician, `/c` client, `/ops` staff) that `/home` sorts you into. The product being built is described in `docs/prd.md`; the build order is in `docs/sprint-tasks.md`.

## Layout

```
src/core/         pure rules and wire schemas: no I/O, importable by any client
src/server/db/    drizzle schema, Postgres pool, and repos/ (every query scoped to the signed-in user)
src/server/services/  use cases; the only code that writes. Actions and /api/v1 are thin wrappers over it
src/server/auth/  Better Auth instance (magic link + passkeys) and Ctx: getCtx / requireCtx
src/proxy.ts      PUBLIC_PATHS allow-list; everything else needs a session cookie. Pages, routes and actions verify the session themselves
src/lib/followups.ts   pure rules engine: which follow-ups exist for a claim state
src/lib/packet.ts      PDF claim form (pdf-lib), kept for member-form claims (S9)
src/app/(public)/      pages anyone can open; src/app/app, c, ops are the clinician, client and staff areas
```

Use synthetic documents from `corpus/synthetic/` only.

## Scripts

`bun run dev` · `bun run build` · `bun run test` · `bun run typecheck` · `bun run lint` · `bun run db:generate` (after schema changes) · `bun run db:migrate`
