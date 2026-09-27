# Slice N1 — Safety rails, integration modes, deploy tiers, error scrubbing and test tooling

Branch: `slice/n1-safety-rails-and-tooling`. Scope and acceptance: `docs/sprint-tasks.md` → N1.

## Steps

1. Tooling first, so the rest is tested under the final config.
   - `bun add -d @playwright/test fast-check @axe-core/playwright happy-dom @testing-library/react`; `bunx playwright install chromium`.
   - vitest include: `src/**/*.test.{ts,tsx}`, `scripts/**/*.test.ts`, `infra/**/*.test.ts`; `.tsx` under happy-dom.
   - `src/tooling.test.tsx` renders a component with Testing Library.
2. Pure pieces, test first: `src/core/mask.ts` (`last4`), `src/server/deploy.ts` (tier, data class, `assertDevTier`), `src/server/integrations/mode.ts` (`VENDORS`, `modeFor`, `tierAllows`, `VendorOff`).
3. `src/server/boot.ts` `bootProcess(name)`: tier rules per vendor, staging synthetic-only, NODE_ENV=production without a tier refuses, process error handlers, console scrubber (`src/server/scrub.ts`). Child-process test in `src/server/process-errors.test.ts`.
4. `src/instrumentation.ts`: `register()` boots the Node runtime; `onRequestError` logs only name and digest.
5. `src/server/integrations/llm/guard.ts` `assertSyntheticDirectApi(env)`; `src/lib/ai.ts` calls it before any request.
6. `src/server/log.ts`: new id keys; `code` and the identifier keys must match their patterns.
7. Email: `modeFor("email")` picks fixture, live throws `NotConfigured`, off throws `VendorOff`; the fixture prints the outbox path, plus the link for sign-in mail.
8. Repo hygiene: `.gitignore` `data/*` with `!data/payers/` and `!data/codes/`; `GLOBAL_TABLES` in `schema.test.ts`; eslint rules for `@anthropic-ai/*` and `'use cache'`/`unstable_cache`/`cacheLife`; `src/repo-hygiene.test.ts`.
9. Playwright: `playwright.config.ts` (testDir `e2e`, next dev on 3100 against `ferry_e2e_test`), `db:create:e2e`, `test:e2e`, `e2e/helpers/outbox.ts`, `e2e/smoke.spec.ts`, `e2e/scrub.spec.ts` (its own `next start` with `FERRY_SCRUB_ERRORS=1`, fixture route and action under `src/app/e2e-fixtures`, reachable only when `FERRY_E2E_FIXTURES=1`).
10. `bun run test`, `typecheck`, `lint`, `test:e2e`; tick N1 in `docs/sprint-tasks.md`; one commit.
