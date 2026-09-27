# Slice N3a — Audio core and capture relay skeleton

Branch: `slice/n3a-audio-core-and-relay`. Scope and acceptance: `docs/sprint-tasks.md` → N3a.

## Steps

1. `bun add ws` and `bun add -d @types/ws` (direct dependencies).
2. Core, test first (`src/core/capture/`):
   - `pcm.ts`: `downsampleToS16(frame, inRate)` takes exactly one 100 ms frame at `inRate` (≥ 16 kHz) and returns 1,600 int16 samples (box-filtered, clipped); `toS16le()` gives the 3,200 little-endian bytes; `msForBytes()`.
   - `protocol.ts`: zod `FrameHeader {captureId, seq, msOffset}`; binary frame = u16 LE header length + JSON header + PCM; `encodeFrame`/`decodeFrame`; client control `end {reason}`; relay messages `ready`, `ack {seq, audioMs}`; close codes.
   - `gaps.ts`: `END_REASONS`, `gapsFrom(intervals, minGapMs = 2000)`.
3. Relay (`src/server/relay/`), test first:
   - `token.ts`: `issueRelayToken` / `verifyRelayToken`, HMAC-SHA256 over `{captureId, subject, exp}`, 60-second life, `relaySecret(env)` requires 32+ characters.
   - `server.ts`: `startRelay({port, secret, now})` on `node:http` + `ws` (noServer). Upgrade path `/ws/capture/:captureId?token=…`; refusals answered with 401 before the upgrade. Counts audio ms from PCM bytes, keeps connected intervals in memory, a newer connection for the same capture closes the older one (4001 superseded). No fs, no database, logs carry ids and counts only.
   - `main.ts`: `bootProcess('relay')` first, then dynamic import of the server; `bun run relay` on `RELAY_PORT`.
4. Tests: `pcm.test.ts`, `gaps.test.ts`, `protocol.test.ts`, `token.test.ts`, `relay.test.ts` (in-process server, real `ws` client, fs and log spies), `relay-boot.test.ts` (spawned under bun).
5. `.env.example` gains `RELAY_SECRET` and `RELAY_PORT`; `log.ts` allows `port`.
6. `bun run test`, `typecheck`, `lint`; tick N3a in `docs/sprint-tasks.md` and `tasks/todo.md`; one commit.
