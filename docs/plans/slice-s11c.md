# Slice S11c — Homepage, pricing, /for-clients and legal pages, deployable in the prelaunch tier

Branch: `slice/s11c-homepage-prelaunch`. Scope and acceptance: `docs/sprint-tasks.md` → S11c.

## Steps

1. Pure config and copy (`src/core`):
   - `src/core/billing/pricing.ts`: `PRICING {monthlyCents: 5000, trialDays: 7}` (D1 placeholder), `formatUsd`, `dayWord`.
   - `src/core/site.ts`: the contact address ("Talk to us", "Join the beta") and the mailto builders. Placeholder until Ryan names the address.
   - `src/core/copy/home.ts`: every homepage string from docs/spec.html #screen-1, prices and trial length from `PRICING`, plus `AMENDMENTS` (wording changes against the spec) and the prelaunch CTA.
   - `src/core/copy/home-claims.ts`: every promise sentence → a test that exists today ("file > test name") or `flagged-for-Ryan` (a question for Ryan, or awaiting the planned test files a later slice names in sprint-tasks.md); the labels that promise nothing.
   - `src/core/copy/for-clients.ts`: the fixed "invite your therapist" share message (no health words; D3 wording pending).
   - `isPrelaunch(env)` in `src/server/deploy.ts`: tier `prelaunch` implies `FERRY_PRELAUNCH=1`; any other non-empty value but `0` also turns it on, and boot refuses anything but `0` or `1`.
2. Tests first: `home-copy.test.ts`, `home-claims.test.ts`, `pricing-grep.test.ts`, `banned-patterns.test.ts`, `prelaunch.test.ts` (build, then `next start` in the prelaunch tier with every vendor off), `e2e/home.spec.ts`; proxy tests for prelaunch 404s.
3. Layout: the root layout keeps only html/body, fonts, the install prompt and the service worker. The signed-in areas get the existing header through `src/ui/app-shell.tsx` (one-line `layout.tsx` per segment); public pages get the site header and footer from `src/ui/home/*`, so no public page links to /account.
4. Homepage `src/app/(public)/page.tsx` from `src/ui/home/*` (banner, header, hero, promises, built-for, how it works with a pressed-button capture switcher, why, security, pricing, questions with details/summary, closing band, footer with /for-clients). Rendered per request so the prelaunch CTA follows the runtime tier.
5. `/for-clients`: share button (Web Share, falling back to a mailto link) with the fixed message. No form, nothing stored.
6. `/legal/[doc]`: rendered from `content/legal/<doc>.md` (front matter `version`, `placeholder: true`) by a small loader in `src/server/legal.ts`.
7. Prelaunch tier: the proxy answers 404 to every path outside `PRELAUNCH_PATHS`; Start free and every trial CTA read "Join the beta" and open the mailto; Log in is hidden.
8. `bun run lighthouse:home`: `scripts/lighthouse/home.ts` builds, starts the prelaunch server, runs `bunx lighthouse` (mobile default) and exits non-zero below 90 for performance or accessibility.
9. `bun run test`, `typecheck`, `lint`, `test:e2e`; tick S11c boxes in `docs/sprint-tasks.md`; one commit. Not merged to main.
