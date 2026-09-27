# Slice N0 — Docs of record (2026-09-27)

Docs only; no code. Source: the 2026-09-27 replan (approach, 47 slices, execution order, dropped/deferred lists, `claudeMdChanges`, risks) and today's founder decisions (HealthScribe on AWS us-east-1, 24-hour transcript erasure, the $9 plan and Autopilot deleted, $50/month membership held in config).

## Steps

1. `CLAUDE.md`: apply `claudeMdChanges` verbatim (what this is, read-first list, invariants, stack, boundaries, conventions, freeze date, decisions log).
2. `docs/sprint-tasks.md`: replace with the replan. Generated from the plan JSON so every slice carries scope, acceptance, depends on, fixture path and founder blockers; then the hand-written parts:
   - F-table with needed-by dates, adding F13–F15; founder checks; D1–D5 and the eight product questions
   - P0 coverage table, one row per `- [ ]` under `### P0` in `docs/prd.md`, numbered by position in its group, naming slices and test files
   - "PRD changes awaiting D2": the 12 items, each pending
   - gates A, B, C, D, E2, E; dated execution order; slip order and the never-cut rule
   - replaced, merged, dropped and deferred slices with reasons; S3 open only for the passkey check
3. `docs/architecture.md`: D1, D10, §2 (relay), §3 file table, §4, §5 table list, §6 access model and keys, §7 timers, §8 subscription and `modeFor`, §9 primitive homes, §10, §12, §13 tiers, §15 close OQ2.
4. `docs/60-day-sprint.md`: rewrite around the PRD success metrics; freeze Oct 18, beta Nov 2–15, launch Nov 17.
5. `docs/spec.html`: `90837 · 60 min` → `90834 · 48 min`; Tech tab stops calling pg-boss and extraction built; speech-to-text line reflects the decision. Homepage copy waits for D2 item 10.
6. `FERRY_BRAND.md`: §1 note about the S3c §13 clinician draft; flag §12.3 "Snapped and sent" for Ryan.
7. `tasks/todo.md`: reset to N1, N3a, S18a; keep the open S3 passkey check.
8. Verify: stale-term grep, P0 box count vs coverage rows, coverage slice ids exist as headings, per-slice line counts, `grep -n 90837 docs/spec.html`, diff stat only `.md`/`.html`, then test, typecheck, lint.
