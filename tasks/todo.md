# Next up (Mon Sep 28)

From the 2026-09-27 replan in `docs/sprint-tasks.md` (execution order). N0 (docs of record) is done.

- [x] N1 — Safety rails, integration modes, deploy tiers, error scrubbing and test tooling
- [x] N3a — Audio core and capture relay skeleton (ws, token, counting, no writes)
- [x] S18a — Installable web app shell: manifest, service worker, install prompt, offline page
- [x] N2a — Access model: contexts, roles, guards and staff:grant

- [ ] N3b — Phone recorder, `dev:phone` tunnel and device matrix (code done, 2 criteria open: the fake-mic e2e and Gate A, both in the manual checks below)

Then Wed Sep 30: N2b.

# Open manual checks

- [ ] N3b Gate A (Tue Sep 29 evening): `brew install caddy cloudflared`, then `bun run dev:phone`, scan the QR code and fill `docs/plans/capture-device-matrix.md` (iPhone on iOS 18.4+, Android if available). Synthetic speech only.
- [ ] N3b: `e2e/mic-spike.spec.ts` skips its fake-mic test until macOS grants microphone access to the app running Playwright (System Settings → Privacy & Security → Microphone). Run `bun run test:e2e` once from Terminal and click Allow, then the test runs instead of skipping.

- [ ] S3: on `/account`, add a passkey with Touch ID; sign out; on `/sign-in` choose "Use a passkey instead". Tick the criterion and the slice in `docs/sprint-tasks.md` when it works, or tell Claude what happened.
