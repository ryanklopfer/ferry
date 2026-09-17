# Sprint 0 — spec package and repo prep

- [x] One repo at `~/code/ferry`, MVP + docs imported, under git
- [x] Baseline green: test, typecheck, lint
- [x] `docs/architecture.md` written, self-reviewed, approved (2026-09-17)
- [x] `FERRY_BRAND.md` imported with the layered-tracker amendment (§12)
- [x] `CLAUDE.md` reconciled (web-first, 16 states, new invariants)
- [x] `docs/sprint-tasks.md`: 38 slices with acceptance criteria, interfaces, founder blockers, execution order
- [x] `corpus/synthetic/`: generator, 10 superbills, 8 insurance cards, `labels.json`
- [x] `docs/plans/slice-01-postgres.md`: step-by-step plan for Monday
- [x] Review section below filled in

## Review (2026-09-17)

**Delivered.** Six commits on `main`. 66 tests, typecheck and lint green. Nothing pushed.

**Found while doing it.**
- A fresh clone failed typecheck because Next's generated route types did not exist yet; `typecheck` now runs `next typegen` first.
- `sips` rasterizes PDFs at 72 dpi and upsamples; Quick Look (`qlmanage`) renders the vector page properly. The generator uses Quick Look and is therefore macOS-only.
- sharp applies resize before composite regardless of call order; each geometric step in `degrade.ts` has its own pipeline.
- Silent truncation of long descriptions made printed text diverge from its label on two documents. The PDF renderer now throws instead of truncating.
- Stedi's mock eligibility subscriber values render client-side in their docs and could not be fetched. Cards carry synthetic member data; S7 swaps in the mock values with one data edit.

**Not done, and why.**
- No real documents: F9 is the founder's to collect and de-identify.
- No logo or `tokens.json`: the brand export did not include them (F11). `FERRY_BRAND.md` §12.5 says not to improvise one.
- Slice 1 not started: Postgres is not installed yet (F10), and the sprint starts Monday.

**Next session.** Confirm F10, then execute `docs/plans/slice-01-postgres.md`. Order after that: S3 → S2 → S2b → S10.
