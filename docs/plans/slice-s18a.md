# Slice S18a — Installable web app shell

Branch: `slice/s18a-installable-shell`. Scope and acceptance: `docs/sprint-tasks.md` → S18a.

## Steps

1. Core, test first (`src/core/pwa/`):
   - `cache-policy.ts`: pure `cachePolicy(url, origin)` → `precache | network_only | navigate_with_offline_fallback`. `/app`, `/c`, `/i`, `/ops`, `/dev`, `/api` (and below), other `/_next/*`, cross-origin and unhashed dev chunks are `network_only`; only `/offline`, content-hashed `/_next/static`, fonts under `/fonts/` and `/_next/static/media/`, `/icons/*` and `/worklets/*` are `precache`; every other same-origin path is `navigate_with_offline_fallback` (never stored).
   - `icons.ts`: `APP_ICONS` (192, 512, maskable 512), each `placeholder: true` until F11.
2. Boot, test first: `assertBootable(env, icons = APP_ICONS)` refuses the prod tier while any icon is a placeholder; prelaunch, staging and dev allow it.
3. Manifest and icons: `src/app/manifest.ts` (name from `BRAND`, `start_url` `/home`, standalone, cream background and theme); plain navy PNG tiles in `public/icons/`; `COLORS` in `src/core/brand.ts`.
4. Service worker: `src/pwa/sw.ts` precaches `/offline` and the icons at install, serves `precache` URLs cache-first (storing only same-origin 200s), falls back to `/offline` for failed navigations, leaves `network_only` alone, and clears Cache Storage on a `sign-out` message; the next successful navigation fetches the public shell again (without cookies) so the offline fallback survives sign-out. `scripts/pwa/build-sw.ts` (`bun run build:sw`) bundles it to `public/sw.js` with a cache version hashed from every `next build` input (src, public, build config) and any `src/ui/capture/*-worklet.ts` to `public/worklets/`; both outputs are gitignored and `dev`, `build` and the Playwright web server run it first.
5. UI: `src/ui/service-worker.tsx` registers `/sw.js`; `src/ui/install-prompt.tsx` (beforeinstallprompt button; iOS Add to Home Screen sheet; hidden when standalone); `src/ui/pwa.ts` `clearAppCaches()`; sign-out calls it and then hard-navigates to `/sign-in` so no in-memory page data survives.
6. Pages: `src/app/(public)/offline/page.tsx` with copy that promises nothing will be sent later (`offline-copy.test.ts`); a minimal `/home` that redirects to `/` until N2b adds role routing.
7. Routing and headers: proxy matcher leaves `/manifest.webmanifest`, `/sw.js`, `/worklets/`, `/icons/` and `/offline` alone; `next.config.ts` sends `Cache-Control: no-store` on `/app`, `/c`, `/i`, `/ops`, `/dev` and `/api`, and `no-cache` on `/sw.js`.
8. e2e `e2e/pwa.spec.ts`: CDP `Page.getInstallabilityErrors` is empty; public shell files return 200 signed out; after signed-in visits Cache Storage holds only precache-policy entries (none under `/app`, `/c`, `/i`, `/api`); sign-out empties it, and the offline page still works after sign-out.
9. `bun run test`, `typecheck`, `lint`, `test:e2e`; tick S18a in `docs/sprint-tasks.md` and `tasks/todo.md`; one commit.
