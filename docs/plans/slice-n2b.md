# Slice N2b — Public routes, /start fork, proxy PUBLIC_PATHS and patient-MVP deletions

Branch: `slice/n2b-public-routes`. Scope and acceptance: `docs/sprint-tasks.md` → N2b.

## Steps

1. Tests first:
   - `src/proxy.test.ts`: table over `PUBLIC_PATHS` (signed out, each passes); `/app/claims` → /sign-in; `/api/v1/claims` → 401; `/dev/mic` and `/api/dev/*` pass only in the dev tier.
   - `src/server/auth/guards.test.ts`: a checker over every `page.tsx` (URL from the file path, route groups dropped): `/app` needs `requireClinician()`, `/c` `requireClient()`, `/ops` `requireStaff()`; any page without a guard must be on `PUBLIC_PATHS`; `/dev` pages need the spike key. Synthetic cases prove each failure is caught. The expected `PUBLIC_PATHS` list is mirrored in the test.
   - `src/app/home/home-redirect.test.ts`: clinician → /app, client → /c, staff → /ops, pending → /start.
   - `src/app/(public)/start/start-fork.test.ts`: a pending user's 'I'm a client' goes to /for-clients, the role stays pending, /for-clients links nowhere into clinician onboarding, and /app is a 404 for them.
   - `src/deletions.test.ts`: no `billingProviderTaxId` under src/app; `src/server/storage/local.ts` and the `documents` table (schema and ferry_test) are gone; no src file imports `putFile`.
2. `src/proxy.ts`: exported `PUBLIC_PATHS` and `DEV_PUBLIC_PATHS` (`/x/*` means anything under /x/), `isPublicPath(path, tier)`; matcher narrows to everything but `_next/` and `favicon.ico`, so the list in code is the only allow-list.
3. Public pages under `src/app/(public)/`: `/` (BRAND.name placeholder), `/start` fork, `/for-clients`, `/i/[token]` stub, `/legal/[doc]` stub (the six texts S3b versions; others 404). Signed-in placeholders: `/app` (requireClinician), `/c` (requireClient), `/ops` (requireStaff). `/home` redirects by role; sign-in and the magic link land on `/home`.
4. Deletions: `src/app/page.tsx`, `/plans`, `/plans/new`, `/claims/*`, `src/app/actions.ts`, `/api/claims/[id]/{superbill,packet}`, `components/follow-up-card.tsx` and `superbill-preview.tsx`, `src/lib/templates.ts`, `src/lib/ai.ts`, `createClaimFromUpload`, `services/documents.ts`, `services/follow-ups.ts` (its only callers were the deleted actions, and drafting needed ai.ts), `repos/documents.ts`, `storage/local.ts`, the `documents` table (new migration). `packet.ts` loses the patient-voice cover letter (from templates.ts) and keeps the claim form for S9. `hasSuperbill` leaves the v1 claim DTO.
5. Tests that built claims through `createClaimFromUpload` create them through `claimsRepo.create`; the ai.ts cases in `guard.test.ts` go with the file; the layout drops the patient nav.
6. `data/uploads/*`: sha256 each file against `corpus/synthetic`; matching copies go to the macOS Trash (recoverable); any other file is listed for Ryan.
7. `bun run test`, `typecheck`, `lint`; tick N2b in `docs/sprint-tasks.md`; one commit.
