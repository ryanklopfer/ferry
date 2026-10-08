# Denial agent: design

Status: draft for founder review · 2026-10-08 · Supersedes the S17 scope in `docs/sprint-tasks.md` once approved.

## 1. Intent

Work every denied claim from detection to resolution with as little human effort as the product invariants allow. The only human steps are a tap by the clinician, or by an office delegate the clinician has authorized, on anything that carries clinical content or changes codes. Everything else is automatic.

The module lives inside ferry. It is isolated enough that a standalone offering later (PRD P2, decision D3) is a packaging decision, not a rebuild.

Founder decisions recorded here:
- The clinician's tap stays the single human gate. No appeal type goes out with nobody in the loop.
- The clinician may transfer rights to billing or compliance staff. Delegation scope is the clinician's choice.
- Build inside ferry, not as a separate product.

## 2. Shape

```
signal (scan | 835 | 277)
   └─ normalizeSignal ──► DenialSignal
        └─ denial_case ──► playbook.step(case, input) ──► effects
                                                            ├─ claim events (through transition())
                                                            ├─ openTask (clinician | delegate | client | staff)
                                                            ├─ requestLetterDraft (N15)
                                                            ├─ openCorrectedClaim (S9)
                                                            └─ scheduleTimer / cancelTimer (S10)
```

`src/core/denials/` is pure: no I/O, imports only zod, date-fns and other core modules. The worker executes effects. Claude is called in exactly two places, both through the existing Bedrock wrapper as forced tool calls: classifying an unstructured scanned letter (S16) and drafting clinical paragraphs (N15). Plain-language reasons come from `data/codes/carc-rarc.json`, never from the model.

## 3. The denial case

One `denial_cases` row per claim (dcs_): user_id, client_id, claim_id, state, playbook_id, playbook_version, reason {group, carc, rarcs[]}, rationale (sealed, from S16), lines[] (service line indexes in scope), appeal_level, letter_date, opened_at, closed_at. CLIENT_SCOPED.

`denial_case_events` (dce_): the case's own audit log. Case-internal transitions write here and never to `claim_events`. Only effects that apply a claim event go through `transition()`.

States and owners:

| State | Meaning | Moved by |
|---|---|---|
| detected | a denial signal arrived | system |
| classified | reason resolved, playbook chosen | system |
| auto_fixing | playbook doing work that needs no tap | system |
| awaiting_tap | corrected claim or letter ready for approval | clinician or delegate |
| sent | fix or appeal reached the payer | system |
| awaiting_payer | waiting on the payer's answer | system or payer signal |
| resolved | paid, counted toward deductible, or withdrawn | system |
| exhausted | all levels used or deadline passed | system |

A generated state × event matrix test proves every pair not in the table is refused.

## 4. Playbooks

A playbook is a pure, versioned record in `src/core/denials/playbooks/`, keyed by reason codes. It declares:
- fix kind: `resubmit` | `appeal` | `client_action` | `clinician_choice`
- steps that run automatically, steps that need a tap, and the minimum delegate scope for each tap
- the N15 letter kind, the reason-paragraph key, and the attachments
- the appeal level sequence
- which timer kinds apply

Launch set (from S17, revised):

| Codes | Fix | Notes |
|---|---|---|
| CO-50 | appeal | necessity; clinical paragraphs from N15; rationale-keyed reason paragraph |
| CO-197, CO-15 | appeal | authorization; the 271 prior-auth indicator picks "none required" vs "retroactive requested"; parity paragraph allowed |
| CO-242, PR-242 | appeal | out of network; cites the 271 on file; parity paragraph allowed |
| CO-29 | appeal | timely filing; attaches the 277CA acceptance date |
| CO-16, CO-11 | resubmit | corrected claim; `step()` decides auto vs tap from the field diff |
| CO-27 | client_action | new insurance |
| anything else | clinician_choice | "pick the reason" task with a plain list; never a staff exception |

`step(case, playbook, input) → { next, effects }` is the single source of truth for auto vs tap. A playbook never declares "auto corrected claim"; it declares "corrected claim" and the diff decides.

## 5. Delegation and taps

`delegations` (dlg_): user_id = the clinician (tenant), delegate_user_id, scope `administrative` | `clinical`, authorization_version, granted_at, revoked_at. Membership-style, like `client_memberships`: one user may be a delegate for several clinicians, and a clinician may be a delegate for an associate. No new role value; `ROLES` is unchanged.

`DelegateCtx` is built only by `delegateCtxFor(self, delegationId)` from an active, unrevoked delegation at the current authorization version. `ctx.userId` is the clinician, `ctx.actorUserId` is the delegate. Every repo still filters through `tenantWhere`. The clinician's entitlements apply, not the delegate's.

Scope:
- `administrative`: corrected claims whose diff touches only NPI, dates, units, charges or member data; resubmissions; timely-filing appeals whose only attachment is the 277CA; client and staff task handling.
- `clinical`: everything administrative, plus approving letters that cite progress notes, and corrected claims whose diff touches a CPT, ICD-10, modifier or diagnosis pointer.

Access split (replaces the single clinician-only union):
- `NoteCtx` = ClinicianCtx | SystemCtx: notes, transcripts, captures, the Tax ID, the redraft path.
- `LetterCtx` = ClinicianCtx | SystemCtx | DelegateCtx(clinical): letter drafts and the editor.
- `CitationCtx` = LetterCtx: a `citationsRepo` exposing only {noteId, lineId, lineHash, approvedAt}, never text. N15 validation runs on ids and hashes; a delegate who strips every citation hits flag-and-block, never redraft.
- Delegates never grant, change or revoke delegations (ClinicianCtx only).

Every tap records `actor_user_id`, time and a hash of what was approved. `claim_events` and letter approvals gain `actor_user_id` in S10, before any rows exist. A delegate signs with their own name "on behalf of" the clinician; the rendered letter carries the clinician's name and NPI. Revocation is immediate; open tasks fall back to the clinician. A new authorization version makes every grant stale until the clinician re-signs.

Launch scope: ship the table, the scope column, the actor id and the context split now. Enable `administrative` at launch; enable `clinical` after Gate E2.

## 6. Signal intake

Precedence: scan > 835 > 277.

- **Scan (S16), primary at launch.** The client is the payee and always receives the EOB. `confirmMail` hands confirmed fields (denialCodes, letterDate, rationale) to the module instead of opening a letter task directly.
- **277 (S13), trigger only.** A 277 carries a status category and status code, never a CARC. A 277 denial opens the case in `detected`, opens one client task "scan the letter when it arrives", and starts `reason_wait`. S13's `denied_co50`-style fixtures are renamed to status categories.
- **835, not built before launch.** ERA enrollment is exclusive to one clearinghouse per provider per payer (`docs/reference/clearinghouse-vendor-evaluation.md` §1); enrolling a clinician who already receives ERAs through an EHR would steal that feed. After Gate E2 it becomes an explicit clinician opt-in with a warning, never an auto-created `payer_enrollments` row. When used: the webhook seals the 835 as a kept record in `external_calls`, enqueues one id-only job {remitId, clpIndex, tenantId} per claim line, idempotent on that pair, each under its own SystemCtx.

`normalizeSignal(source, payload) → DenialSignal {claimId, source, payerRef, codes[], lines[], amounts?, letterDate?, rationaleRef?, recordRef}`. Matching: patient control number for 835 and 277; S16's payer + date-of-service match for scans.

Rules:
- One case per claim. A signal for an open case becomes a `payer_response` event; a new reason on another line joins the open case. Idempotent on source + payerRef.
- A stronger source re-classifies a case before `awaiting_tap`. After that point a disagreeing signal opens a staff exception.
- Tenant resolved through `resolvers.ts`; job payloads are ids only; nothing from the payload reaches logs or job tables.

## 7. Letters, corrected claims and sending

**Standing.** On a non-assigned claim the client is the claimant. The client filing consent gains an authorized-representative designation (one F4 clause, versioned). The clinician files the appeal on the client's behalf as authorized representative. Appeals are refused while the client's consent predates that version. A payer flagged in S6b as requiring its own representative form holds in a staff exception until the form is on file.

**Appeal letter assembly**, in order:
1. Fixed frame (S17 template): identifiers, dates of service, denial reference, appeal level, request for reprocessing.
2. One reason paragraph, keyed by CARC plus the rationale S16 extracted from the letter. Parity language only for CO-197/CO-15 and CO-242/PR-242.
3. Clinical paragraphs (necessity appeals only) from N15, with citations, N15 rules unchanged.

Attachments are declared by the playbook: rendered original claim, the denial reference, the 277CA for timely filing, cited notes as PDF when the level requires records, the representative designation. Tax ID and signature block are added at S14 render time.

**Corrected claims.** `openCorrectedClaim` carries the exact field diff. The frequency-7 claim carries every original service line with only the diffed field changed. Appeal-kind playbooks never use frequency 7. Every corrected claim attaches the original 277CA acceptance date. 837P invariants unchanged.

**Sending.** Nothing goes out without a recorded tap. Appeals go by fax through S14's `FaxSender` to the S6b appeals fax, or to a clinician print-and-mail task when only a mail address exists or the fax fails twice. Never a portal or electronic route. Corrected claims go through S9's submission effect. Fax confirmation or submission acceptance moves the case to `sent`; a mail route stays in `awaiting_tap` until the clinician marks it mailed.

**Appeal levels.** Internal, then second-level internal where the payer offers one. **External review is a client task**, not a letter: a prefilled form and the authority from a new `externalReview {authority, route, windowDays}` directory entry. The engine tracks the window and never sends.

**Edges.** A request for information during an appeal routes to the S13 info-request path on the same case. A reversal applies the normal paid or deductible event and resolves the case.

## 8. Timers, escalation and notification

No new timer machinery. Timer kinds on the `denial_case` subject, calendar days, from one pure `deadlineFor(kind, level, fromDate)` anchored at noon UTC. The timer kind includes the appeal level.

| Kind | Starts | Default | Fires |
|---|---|---|---|
| reason_wait | 277 denial, no reason | 10 d | re-nudge client; second fire → clinician "pick the reason" task |
| tap_wait | a tap is pending | 3 d, then 7 d | reminder; second fire reassigns a delegate's task to the clinician |
| appeal_deadline:L | classified with an appeal playbook | from `letter_date`, per regulatory table | warnings at 60/30/7 d; at zero → exhausted |
| payer_response:L | appeal or correction sent | statutory (60 d post-service internal) ; payer rules may only shorten | expiry → external review client task (deemed exhausted) |
| external_window | final internal denial | 4 months | client warnings at 60/14 d; at zero → exhausted |
| mail_wait | print-and-mail task opened | 5 d | reminder only |

A missing `letter_date` shows "deadline uncertain" with the earliest plausible date.

**Single clock.** While a case is open the claim has no timers of its own. The case's effects drive `appealed`, `escalated` and `closed`. The `appealed → escalated` row in `docs/architecture.md` §4 becomes "case effect", not "timer".

**Client milestones.** Exactly four reach the client, each through the claim's own transition: denied, appeal sent, decision, external review needed. Case-internal transitions never notify. Clinicians and delegates hear only when a task is assigned to them. Timer warnings are task reminders, not notifies. No message names a payer, code, amount or diagnosis.

**Staff exceptions**, only where staff can act without PHI: missing payer route, fax failure after retry, enrollment gap, representative form missing, a disagreeing signal after a tap. Each is one staff-audience task with ids, kind and age; acted on through `staffActFor`.

## 9. Testing

Test-first throughout. Only seams are tested where S10, N15, S14 and S16 already prove the inside.

Pure core:
- `playbook.test.ts`: one input→effects table per playbook, plus the unknown-code path.
- `case-transition.test.ts`: generated state × event matrix.
- `normalize.test.ts`: per-source fixtures; a 277 yields no reason; precedence before and after a tap.
- `deadline.test.ts`: calendar-day table, month ends, missing letter date.
- `diff-scope.test.ts`: every claim field classified auto | administrative | clinical; fails on an unclassified new field.

Access:
- `isolation.test.ts` gains delegate D bound to X (administrative): reads no Y rows, no notes; approves an admin tap; refused a clinical tap until scope changes; refused on the request after revocation; stale authorization version refuses every tap.
- Compile-time refusal: one `// @ts-expect-error` per clinician-only repo under `DelegateCtx`, proven by `bun run typecheck`, not vitest.
- `citation-ctx.test.ts`: a marker in a note body never appears in anything a delegate context fetches.

Engine:
- `intake.test.ts`: replay and rescan are no-ops; one case per claim; line joins; a multi-tenant 835 enqueues id-only jobs under the right tenant.
- `notify.property.test.ts` extended: fast-check over interleaved case and claim events; one notify per applied claim transition, zero per case-internal transition; no claim-subject timer rows while a case is open.
- `milestones.test.ts`: a full denial→appeal run produces exactly the four client notifies.
- `clm-invariants.property.test.ts` extended: lines(corrected) equals lines(original) except the diff.
- `appeal-assembly.test.ts`: order, parity gating, 271-driven authorization sentence, attachments match the playbook, Tax ID absent from the draft and present in the PDF.
- `letters.test.ts` extended: appeal send refused when the client consent predates the representative version (reuses `consents.test.ts` staleness fixtures); idempotent on case id as `requestRef`; delegate flag-and-block path.
- `staff-exceptions.test.ts`: only the listed kinds reach staff, ids and ages only.

End to end:
- Rewrite Gate E2 step 3 (N17): 277 denial → client scan task → `/c/scan/mail` fixture → classified → delegate admin tap on a correction → clinician tap on a necessity appeal → fax → clock advance → reversal → four milestones in order; second run with delegation revoked mid-flow lands the task on the clinician.
- Add an e2e that drives one `/c/scan/mail` scan before S16 closes, so E2 is not the first attempt at the camera path under Playwright.

Hygiene:
- The denial work is registered as slices in `docs/sprint-tasks.md` so `repo-hygiene.test.ts` sees the named files; hygiene extended to assert existence for files under ticked slices.
- Columns test covers `denial_cases`, `denial_case_events`, `delegations`, the regulatory table (GLOBAL_TABLES) and `externalReview` entries.
- No-PHI send wrapper test covers every new message template. Job payload test covers the new job kinds.

## 10. Legal and schedule items for the founder

Three new texts for the attorney (F4), all lead-time items:
1. Delegation authorization, with an optional clinical clause.
2. Authorized-representative designation inside the client filing consent.
3. External review client-task wording (not a consent; copy review only).

Schedule: all of this lands after the Oct 18 freeze as the P0 denial work already scheduled (S17 on Oct 22) and is proven by Gate E2 on Oct 29. The 835 opt-in and `clinical` delegate scope are post-E2.

## 11. Out of scope

- Any automatic send without a tap.
- 835 before launch.
- A standalone product. The module boundary keeps it possible.
- Regulator complaints (S23, P2) and misdirected payment handling (S22, P1) stay where they are.
- Holiday tables for business-day nudges.
