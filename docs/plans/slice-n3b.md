# Slice N3b — Phone recorder, dev:phone tunnel and device matrix (Gate A)

Branch: `slice/n3b-phone-recorder-dev-phone`. Scope and acceptance: `docs/sprint-tasks.md` → N3b.

## Steps

1. Core, test first: `createFramer(inRate)` in `src/core/capture/pcm.ts` turns the audio thread's 128-sample quanta into whole 100 ms frames of 16 kHz s16le (`pcm.test.ts`).
2. Dev gate, test first (`src/server/dev-spike.ts`): `spikeKey(env)` is `FERRY_SPIKE_K` only in the dev tier and only when it is 32+ characters; `spikeKeyValid(k)` compares in constant time; `devRunId(k)` is a hash prefix; `manifestStartUrl(env)` is `/dev/mic?k=…` with a key, `/home` otherwise; `relayUrlFor(captureId)` uses `FERRY_RELAY_URL` or the same-origin `/ws/capture/:id` path Caddy serves.
3. Routes (signed out, proxy matcher lets `/dev/` and `/api/dev/` through; every route 404s without the gate):
   - `/dev/mic` (page plus the `MicSpike` client component), `/dev/file-input`, `POST /api/dev/relay-token` issuing tokens bound to `{captureId, devRun:<devRunId>}`.
   - `src/app/manifest.ts` takes `start_url` from `manifestStartUrl()` and is `force-dynamic` so a key is never baked into a build.
   - Tests: `src/app/dev/dev-routes.test.ts`, `src/app/manifest.test.ts`, `src/proxy.test.ts` rows.
4. Browser: `src/ui/capture/pcm-worklet.ts` (built to `public/worklets/pcm.js` by `build:sw`) and `src/ui/capture/recorder.ts` (getUserMedia → AudioContext → worklet → ws; wake lock; visibility, pagehide, context state incl. `interrupted`, track mute/ended; unacked frames resent after a reconnect; audio-clock vs wall-clock gaps so any loss shows with a cause; every track stopped on stop). No MediaRecorder.
5. Corpus: `scripts/corpus/wav.ts` (pure WAV writer, tested) and `scripts/corpus/audio.ts` (`bun run corpus:audio`) render `corpus/synthetic/audio/tone-10s.wav` and a `say` + `afconvert` speech file.
6. `bun run dev:phone` (`scripts/dev/phone.ts`): `assertDevPhone` (assertDevTier + FERRY_DATA_CLASS=synthetic) before anything starts; needs `caddy` and `cloudflared` on PATH (founder installs them); per-run key and relay secret; starts relay, next dev, Caddy (`/ws/*` → relay, rest → Next) and a cloudflared quick tunnel; prints a QR code (`toqr`) of `https://<tunnel>/dev/mic?k=…`. `next.config.ts` allows `*.trycloudflare.com` as a dev origin. Test: `scripts/dev/dev-phone.test.ts`.
7. Playwright: the relay joins `webServer`; the Next server gets `FERRY_SPIKE_K`, `RELAY_SECRET` and `FERRY_RELAY_URL`. `e2e/mic-spike.spec.ts` records 10 s from the fake device fed with `tone-10s.wav` and reads the relay's count from the page.
8. `docs/plans/capture-device-matrix.md` for Ryan's run (Gate A). `.env.example` notes.
9. `bun run test`, `typecheck`, `lint`, `test:e2e`; tick N3b's code criteria in `docs/sprint-tasks.md` and `tasks/todo.md`; one commit. Gate A stays open for Ryan.
