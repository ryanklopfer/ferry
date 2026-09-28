# Slice N5 — Clinician Start free, onboarding, profile, fee schedule, filing authorization and sign-up policy

Branch: `slice/n5-clinician-onboarding`. Scope and acceptance: `docs/sprint-tasks.md` → N5. Design: architecture §5 (tables), §6 (access model, tiers).

## Steps

1. Pure core (`src/core`), tests first:
   - `clinician.ts`: note formats, modalities, the behavioral taxonomy set (our own labels), `ProfileInput` (zod), `billingParty(profile)` (solo: NPI-1 bills and renders; group: NPI-2 + EIN bills, NPI-1 renders), `liveFilingAllowed(profile, legal)`.
   - `fee-schedule.ts`: `COMMON_BEHAVIORAL_CODES` with our own short descriptions (never AMA descriptor text), `chargeFor(schedule, cpt)` → cents or `{ missing: cpt }`.
   - `signup.ts`: `signupDecision({ tier, prelaunch, allowlist, openSignup }, email)` → open, beta-only refusal with plain copy, or mailto.
   - Tests: `billing-party.test.ts`, `live-filing.test.ts`, `signup-policy.test.ts`, `fee-schedule.test.ts` (pure half).
2. Schema + migration 0003: drop `providers` and `claims.billing_provider_id` / `rendering_provider_id` (claims keep their as-filed snapshot columns); add `clinician_profiles` (prf_, `user_id` UNIQUE, `npi` UNIQUE across tenants, sealed `tax_id` and `practice_address`, `tax_id_bidx`, `tax_id_last4`) and `fee_schedule_items` (fee_, UNIQUE (user_id, cpt_code), CHECK charge_cents > 0). Classify every column in `columns.ts`; a `taxId` blind-index normalizer.
3. Repos: `repos/clinician-profiles.ts` and `repos/fee-schedule.ts`, `ClinicianOnlyCtx` plus `assertNotClient`; `resolvers.profileOwnerByNpi` (ids only). Delete `repos/providers.ts`, the provider checks in `repos/claims.ts`, and every test fixture that used it (`db/testing.ts` gets `seedClinicianProfile`).
4. Sign-up: `src/server/auth/intent.ts` signs and verifies an httpOnly intent cookie (HMAC under the auth secret, bound to the email's hash, 30-minute expiry). `/start?door=clinician` asks for an email only; its action checks `signupPolicy`, sets the cookie and sends the magic link with callback `/app/welcome`.
5. Services (`services/clinician.ts`): `completeClinicianSignup` (verified intent + pending user whose email matches → `setRoleOnServer` → terms and BAA consents; prod tier calls `assertLiveLegal(['terms','baa'])` first), `saveProfile` (NPI check digit before any lookup; NPI taken by another tenant → plain refusal), `setFees`, `authorizeFiling` (typed name, time, IP, user agent, doc hash via S3b `recordConsent`), `completeOnboarding` (prod: `assertLiveLegal`), `onboardingStep`, `profileView` (last four only), `profileForClaims(ClinicianOnlyCtx)`.
6. Tests: `src/server/services/clinician.test.ts`, `src/server/services/fee-schedule.test.ts` (fee edit affects only claims built afterwards), extend `ctx.test.ts`, `raw-dump.test.ts`, `log.test.ts`, `schema.test.ts`, `scope.test.ts`, `columns.test.ts`, `start-fork.test.ts`.
7. UI: `/app/welcome` (agree to terms and BAA → passkey offer → practice → fees → filing authorization), `/app` sends a clinician who hasn't finished onboarding to `/app/welcome`, `/home` sends a pending user holding a valid intent there too; `/app/account/profile` and `/app/account/fees` (Tax ID shown as last four only).
8. E2E: `e2e/onboarding.spec.ts` (email only, no card field, completes at 390 px and 1280 px, last four only), `e2e/passkey.spec.ts` (CDP virtual authenticator).
9. `home-claims.ts` BAA proof names the real N5 test. Tick N5 in `docs/sprint-tasks.md`. `bun run test`, `typecheck`, `lint`, `test:e2e`; one commit, not merged.
