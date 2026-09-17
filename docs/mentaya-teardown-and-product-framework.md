# Mentaya Teardown → Product Framework (2026-09-16)

Companion to the three SWOTs (`mentaya-`, `reimbursify-`, `thrizer-competitive-swot.md`) and the MVP status doc. Part 1 reverse-engineers Mentaya from ~90 primary pages (help center, marketing, MSA/ToS, BBB, practice FAQ pages, six podcast transcripts). Parts 2–5 turn the failures of all three companies into the product spec and both user journeys.

---

## Part 1 — Mentaya, reverse-engineered

### 1.1 The business model in one paragraph

Mentaya (Zaya Health Inc.) sells a **free** claims service to private-pay therapists and charges their **clients** 5% of the session fee per claim, at submission time, whether or not the client gets anything back. The therapist is the distribution channel, not the customer; the client is the payer, not the user. Revenue is indexed to sessions confirmed, cost is indexed to denials worked by humans, and the only recurring SaaS line is a $29–39/mo benefits checker sold as a *marketing* tool. It is a two-sided marketplace where one side does all the work (therapist confirms every session), the other side pays (client), and the company owns neither the payment rail nor the EHR — it owns the **claim trigger**.

### 1.2 Business model canvas

| Block | Mentaya |
|---|---|
| Customer segments | (1) Private-pay mental-health therapists and group practices, solo to ~50 clinicians. (2) Their PPO/POS/HDHP clients. Explicitly not HMO/Medicaid/Medicare, not PT/SLP/RD (interest form only). |
| Value proposition | Therapist: "get your full cash rate," $0, no contract, no processor switch, keep your EHR, "we chase down reimbursements." Client: "up to 80% back," "sit back & relax – no more superbills," first claim free, "reimbursement or your money back." |
| Channels | Therapist-business podcasts with promo codes (productive, TGPE, PATRICK, PPS, LINZY, CPH, mindmoneybalance), Heard, CPH Insurance, Hushmail partners, Facebook ad landing pages, live demos, Calendly sales calls, therapist-published client FAQ pages, referral credit links (`mentaya.com/t/<slug>`), benefits-check links on Psychology Today profiles. |
| Customer relationships | Self-serve signup (<1 min), email support (support@), "24/7 support" and "concierge team" in marketing, single named Customer Success lead, email-only in practice (BBB 7/2026). |
| Revenue streams | 5% of session fee per claim (client-paid, at submission, pre-deductible included; therapist can absorb all-or-nothing). 10% for client-uploaded past superbills. $29/mo annual or $39/mo monthly benefits checker per practice. Stripe pass-through at cost (2.9% + 30¢ card; 0.8% capped $5 ACH). Referral credits. |
| Key activities | Claim prep and 837P submission under Mentaya's own NPI-2/EIN; payer non-par registration on the therapist's behalf (SSN, W-9, CP-575, 2–4 weeks); denial resubmission by humans; forwarding payer checks/VCCs that land at Mentaya on to clients; eligibility checks. |
| Key resources | Clearinghouse connection (unnamed), Stripe, Intercom help center, a small ops team, the therapist podcast network, the Management Services Agreement that assigns insurance payments to Mentaya. |
| Key partners | Pear VC, Banana Capital; Heard; CPH; Hushmail; Productive Therapist; podcast hosts. No EHR integrations ("No Integrations at this time"). |
| Cost structure | Concierge labor (denials, registrations, payment forwarding), clearinghouse per-transaction, fee refunds on unsuccessful claims, Stripe at cost, sales calls/demos, podcast sponsorships. |

### 1.3 The money machine

For a $200 session, Mentaya takes $10 the moment the therapist confirms the session. On a full caseload (~100 sessions/mo) that is ~$1,000/mo per therapist from clients — the highest client-side take in the category (Thrizer $140–700, Reimbursify ≤$279). Four structural bets make this work:

1. **The therapist is free, so the therapist recruits the client.** Every practice that joins publishes its own "we use Mentaya" FAQ page. CAC is near zero after the podcast spend.
2. **Charge at submission, not at outcome.** Revenue does not wait 30–90 days for adjudication, and pre-deductible sessions (often the first 10–20 of a plan year) are billed at full rate for $0 client benefit. Thrizer's math: a weekly $200 client pays Mentaya $40/mo while getting nothing back.
3. **File under Mentaya's own NPI-2/EIN.** The MSA says "all rights, title, and interest in insurance payments…will be reassigned…to the Company." This lets Mentaya bypass per-therapist payer enrollment for many payers and control the claim, but it also means payer money sometimes lands at Mentaya and must be forwarded — the source of both BBB complaints (a $785 virtual-card payment "not received," and June-2026 reimbursements "received on 7/12" and still unpaid at month-end).
4. **No float, no rail.** Unlike Thrizer, Mentaya never advances money and never requires processor migration. Stripe is optional and at cost. Balance-sheet risk is zero; the cost is that the client has no affordability lever.

The guarantee is the pressure-release valve on bet #2. Marketing says "Successful reimbursement – or your money back." The governing policy says a submission is "successful if the claim has been approved…and either a payment has been sent **or the claim has been applied to the deductible**," judged after **six months**, and excludes anyone pre-warned of no OON benefits. A client can pay 5%, receive $0, and have had a "successful" claim.

### 1.4 The app, screen by screen

**Therapist side (app.mentaya.com)**

1. *Register* — name, practice type, NPI (pre-licensed: license type). "Less than one minute." No tax ID, address, Stripe, or W-9 yet.
2. *Checklist home* — three tasks: set up benefits checker, add clients, start submitting claims. Demo video, support email, Calendly.
3. *My Profile → Licenses* — type, number, state. Multiple allowed.
4. *Clients tab* — "+ New Client" (email invite) or "Share Invite Link" (custom slug; three link types: referral, benefits check, client invite). Client-initiated connect requests arrive as notifications to approve.
5. *Manage Claim Defaults (per client, once)* — diagnosis, place of service, session length, one CPT, fee. No add-on codes, no units, no second line. 90837 is the ceiling.
6. *Session trigger (pick one or more)* — Home "Submit an OON Claim" quick charge; Sessions tab bulk "Charge and Submit X Claims"; Clients tab "+ New Session" with recurrence; Google/iCal sync that matches events **by client full name in the event title**; SMS after each scheduled session, reply "yes." No reply = nothing is filed (inferred; no documented fallback).
7. *Charge mode (practice-wide)* — Claim Only ($10 to client), Session + Claim ($210 to client, $193.90 to therapist), Session Only ($200, no claim). Absorb-fee toggle is all-or-nothing.
8. *Transactions tab* — void an already-submitted claim. Statuses: Being Prepared → Submitted → (Re-submitted) → Approved | Voided. No Denied, no Paid, no Applied-to-deductible, no amounts.
9. *Benefits Check tab* ($29–39/mo) — name, DOB, member ID → deductible, remaining, coinsurance, estimated $ per practice fee schedule. Shareable link + iframe widget (Squarespace/WordPress/Wix instructions). "Not meant to be 100% accurate"; cannot see allowed amounts.
10. *Practice Settings* — members and roles (admin/member), invite clinicians, disable/enable, per-member calendar sync and SMS number, per-member services & fees for the widget. Group needs its own EIN + NPI-2.
11. *EHR (beta, email-gated)* — scheduling with reminders, free-text session notes, intake documents, Stripe billing. No telehealth, no templates, no integrations.
12. *Payer registration (reactive)* — when a payer demands non-par enrollment, therapist emails SSN (even with an EIN), W-9 p.1, license, CP-575/147-C; Mentaya files, 2–4 weeks.

**Client side (web only; no iOS/Android app)**

1. Email invite from therapist → "Create an account."
2. Profile → card or bank account + insurance ID. HSA/FSA cards rejected for the claim-only fee.
3. "That's it! …sit back & relax." Portal shows claims with one of five statuses, a "Past Superbills" upload (10% fee, current-year, already-paid sessions only), and payment settings.
4. After each session: 5% charge hits the card when the therapist confirms. Portal status flips. Mentaya says it "only reach[es] out if we need your action."
5. Reimbursement arrives from the **insurer** by mailed check + EOB (or the insurer's own direct deposit) — unless the payer paid Mentaya, in which case Mentaya emails to ask for a payout method.
6. Denial → status "Re-submitted" with "expect an update within the next 30 days." No reason shown, no appeal artifact, nothing to do.

### 1.5 The growth loop

Podcast → promo code → 30-day free benefits checker → therapist embeds widget and drops the check link into Psychology Today → prospective client sees "you'd get ~$120 back per session" before booking → therapist converts a private-pay client they'd otherwise have lost → therapist invites the client to Mentaya → client pays 5% forever → therapist writes a "how Mentaya works" page → next client. The paid add-on is the *trial hook*; the free product is the *lock-in*.

### 1.6 Where Mentaya breaks (every item sourced in the SWOT or the agent reports)

| # | Break | Evidence |
|---|---|---|
| M1 | Charges 5% on every session including pre-deductible; no coinsurance or pay-on-outcome option; 10% for self-uploaded superbills | Thrizer critique; help "Self-service past superbills"; BBB 7/2026 |
| M2 | Guarantee drift: "reimbursement or your money back" vs. "applied to deductible counts as success, after 6 months" | 8 different wordings across site/help |
| M3 | Five opaque statuses; denials hidden inside "Re-submitted"; no amounts, no EOB data, no ETA beyond "30 days" | help "Understanding Your Claim Status" |
| M4 | Therapist-gated: a patient whose therapist isn't enrolled cannot use it (except at 10%) | help "Does my therapist need to be on Mentaya" |
| M5 | Files under its own NPI-2 and assigns payments to itself → held/lost reimbursements, VCC processing bug | MSA 2024; BBB 11/2025 and 7/2026 |
| M6 | Email-only support with multi-day latency vs. "24/7" marketing | BBB 7/2026; About page headcount |
| M7 | One CPT, no add-on codes/units/multiple lines; 90837 ceiling; loses testing psychologists, blocks PT/OT/SLP | Testing Psychologist ep. 482; help "Tricky scenarios" |
| M8 | Therapist does the work: per-client claim defaults, session confirmation on every session, calendar matching by exact name, SSN/W-9 paperwork for registration | help "Automated Claim Submission," "Syncing Calendar," "OON registration" |
| M9 | No mobile app, no EHR integrations, EHR beta by email, no telehealth | Slashdot; help "EHR" |
| M10 | Mental health only; Medicare/Medicaid/HMO out; no secondary insurance, out-of-state, or Anthem paper-check guidance for clients | help "Who can use Mentaya"; agent report §5 |
| M11 | Timeline messaging inconsistent (1 week / 30 days / 45 days / 3 months / 6 months) | five help pages |
| M12 | Diagnosis disclosure required with no minimum-necessary explanation to the client; mandatory arbitration | consent template; ToS |

---

## Part 2 — Cross-company failure → solution map

Every negative review, critique, and structural gap across the three SWOTs, paired with the design decision that closes it.

| Failure (who) | Our decision |
|---|---|
| Pay for $0 outcomes: 5% pre-deductible (Mentaya); $3.99 "submit and pray" (Reimbursify) | **Pay-when-paid.** Flat fee charged only when a claim adjudicates with money to the patient. Deductible-only and denied claims cost $0. First claim free. |
| Percentage-of-session or percentage-of-reimbursement fees (Mentaya 5%, Thrizer 5% instant / 1% DD, provider 3%) | **Flat dollar fee, published, capped.** Reimbursify's "we never take a percentage" is a real trust asset; keep it. |
| Guarantee narrower than marketing (Mentaya); no guarantee at all (Thrizer, Reimbursify) | **Guarantee the loop, not the fee:** every claim is worked until final adjudication, every status change is visible, and if we never get a payer decision within the payer's own window we escalate to the state DOI on the patient's behalf. Publish one definition, one page. |
| Opaque status: 5 statuses, denial hidden (Mentaya); status self-reported from a mailed EOB (Reimbursify); email and hope (Thrizer) | **Glass-box tracker.** 14-state machine driven by 277CA/277/835, each state with plain-English meaning, what we're doing next, and a payer-specific ETA. Denial reason codes translated. |
| Therapist-gated (Mentaya, Thrizer post-Aug-2026) | **Patient can start alone with any superbill.** Provider is invited *by the patient* to make it easier, never required. |
| Forced payment-rail switch (Thrizer) | **Never touch the session payment.** Optional Stripe pass-through later, never required. |
| Float / lending risk (Thrizer Instant Reimbursement) | **No float, ever.** Affordability comes from speed (electronic + follow-up) and from the deductible progress view, not from lending. |
| Money routed through the vendor, held or lost (Mentaya NPI-2 + MSA) | **File under the rendering provider's NPI with Accept Assignment = No** so the payer pays the patient directly. We never take assignment. Misdirected-payment playbook when a payer pays the provider anyway. |
| Human concierge as COGS (Mentaya); 4-person email support (Reimbursify); help@ only (Thrizer) | **Automation first:** 276/277 polling, 835 ingestion, denial-code → action mapping, generated appeals, generated DOI complaints. Humans handle exceptions only, and the patient sees the human's note in the timeline. |
| Manual data entry as the product (Reimbursify) | **Vision extraction from any superbill/EOB/insurance card** + NPPES auto-fill + payer directory. Target: photo → ready-to-submit in under 60 seconds with zero typing for a recurring provider. |
| Therapist does the confirming (Mentaya) | **Both sides can trigger.** Patient forwards/snaps the superbill, *or* provider replies "yes" to a text, *or* calendar/EHR sync. Whichever arrives first creates the claim; the other confirms. |
| One CPT, no add-ons (Mentaya) | **Full CMS-1500 line model:** multiple service lines, units, modifiers, add-on codes, POS 02/10 telehealth, supervising provider. Required for testing, PT/OT, SLP, dietitians. |
| Mental health only (Mentaya, Thrizer) | **Multi-specialty from day one** (Reimbursify's real strength): mental health, testing, PT/OT, SLP, RD, lactation, fertility, chiropractic, functional medicine. |
| No mobile app (Mentaya, Thrizer); decaying app reviews (Reimbursify) | **Mobile-first PWA + native wrapper.** Camera is the primary input. |
| Calendar match by exact name (Mentaya) | Fuzzy match + patient-side confirmation fallback; never silently drop a session. |
| Payer registration paperwork dumped on the therapist (all three; Thrizer has 18 BCBS guides) | **Payer playbook engine:** we know per payer whether non-par enrollment is needed, pre-warn at eligibility time, generate the packet, and track it as its own tracked object with ETA. |
| Timeline messaging inconsistent (Mentaya) | **One number per payer,** computed from our own 835 data and shown everywhere ("Cigna PPO: median 19 days, 90th pct 41 days"). |
| No EHR integrations (all three) | **Email-forward ingestion** works with every EHR on day one (SimplePractice, TherapyNotes, Jane all email superbill PDFs). Native integrations later. |
| No metrics published (all three) | **Public scorecard:** days-to-pay, denial rate, appeal win rate, by payer. |
| Diagnosis disclosure unexplained (Mentaya) | Minimum-necessary explainer at consent; patient sees exactly which fields go on the claim. |
| HSA/FSA rejected for the fee (Mentaya) | Fee is a service charge, not a medical expense — say so plainly; accept any card. |

**What works and how we 3–5× it**

| Works today | Their version | Ours |
|---|---|---|
| Session-confirm by text (Mentaya) | Therapist gets an SMS after each scheduled session, replies "yes." | Same, plus: patient can be the one who confirms; reply "yes 2" for two sessions; "no" or "cancel" handled; missed replies roll into a Friday digest; magic-link, no account needed for the provider. |
| Benefits checker as acquisition hook (Mentaya $29–39/mo, Reimbursify $59+/mo, Thrizer free) | Estimate deductible/coinsurance; can't see allowed amounts. | Free, for patients *and* providers, with allowed-amount estimates learned from our own 835 data by payer × CPT × ZIP; shows "sessions until your deductible is met" and updates after every paid claim. |
| Set-and-forget for the client (Mentaya) | Nothing to do after signup. | Nothing to do after the first photo, *and* the client can see everything: a package-tracker timeline, an ETA, a running "$ recovered" total, and a deductible progress bar. |
| Pre-submission scrubbing, clone claim, free resubmits, 2-hour cancel (Reimbursify) | Form-level CPT/ICD checks. | Payer-specific rules (modifier, POS, taxonomy, timely-filing window, non-par status) run before submit; auto-clone for recurring providers; unlimited resubmits; cancel until the clearinghouse accepts. |
| Eligibility before first session (Thrizer, Mentaya) | 270/271 with heavy disclaimers. | Same call, plus payer-specific caveats ("Anthem pays by paper check only; expect +10 days") pulled from the playbook. |
| Free-to-therapist, no contract (Mentaya, Thrizer) | Free; client pays 5%. | Free; patient pays a flat fee only when paid; practice can sponsor on a tiered plan metered by accepted claims. |
| Provider payout protection / no clawbacks (Thrizer) | Applies to their rail. | Automatic, because we never touch provider money. |
| Multi-specialty (Reimbursify) | Listed, but same single-line form. | Specialty-aware templates (testing add-ons, PT units, SLP eval codes). |

---

## Part 3 — Product framework

### 3.1 Positioning

"Photograph any superbill. We file it electronically, chase it until it's paid, and show you every step. You pay a flat fee only when money comes back."

Mentaya is "fully managed billing for therapists." Reimbursify is "DIY filing for patients." Thrizer is "a payment platform." We are **the reimbursement loop for patients, with providers as accelerators** — the lane all three vacated or never entered.

### 3.2 Operating principles

1. **Anyone can start.** No provider enrollment, no invite, no EHR. A superbill is the only prerequisite. (Electronic 837P filing under a provider's NPI needs the provider's one-tap authorization via magic link; until they tap, we file the payer's member claim form on the patient's behalf — the MVP's existing packet path — and the loop runs the same way.)
2. **The loop is the product.** Submission is table stakes; status, follow-up, appeal, and escalation are the moat. Every claim has a next action and an owner (usually the engine) until it is closed.
3. **Never charge for $0.** Fee only on adjudication with payment. Deductible-only and denied claims are free.
4. **Glass box.** Every state change, every payer message, every letter we send is visible in the patient's timeline with a plain-English explanation.
5. **We don't hold money.** File Accept Assignment = No under the provider's NPI. No float, no rail, no assignment to us.
6. **Automate first, staff second.** Humans appear as named notes in the timeline, not as a queue.
7. **Multi-specialty and multi-line by design.** The claim model is a full CMS-1500, not a therapy form.
8. **Publish the numbers.** Days-to-pay, denial rate, appeal win rate per payer — the metrics nobody in the category will publish.

### 3.3 System architecture

Six layers. The existing MVP already has a thin version of layers 1, 3, 4, and 5.

| Layer | Responsibility | Components |
|---|---|---|
| 1. Intake | Turn any input into a structured claim draft | Vision extraction (superbill PDF/photo/EHR export/handwritten; insurance card front+back; EOB), email-forward inbox (`claims@` per user), provider SMS "yes," calendar/iCal sync, EHR integrations (later), Stripe charge webhook (optional, later) |
| 2. Knowledge | Know the payer before submitting | NPPES/NPI registry lookup and taxonomy; payer directory (payer ID, claims address, portal, appeals address, timely-filing days, non-par enrollment required?, pays-by-paper-check?, DOI contact); payer playbooks (Anthem paper-check, BCBS home-plan routing, Cigna OON registration, UHC Optum behavioral carve-out); CPT/ICD/modifier/POS rules by specialty; learned allowed-amount table (payer × plan × CPT × ZIP) from our 835s |
| 3. Submission | Get the claim in the door, electronically, correctly | 270/271 eligibility; pre-submit scrubber (payer rules + specialty rules); 837P via Stedi (CLM07 = C not assigned, CLM08 = N; patient as payee) once the provider has authorized; route by Stedi's per-payer `transactionSupport` flag (SUPPORTED → electronic; ENROLLMENT_REQUIRED → provider enrollment or member-form fallback); fallbacks in order: payer member-claim portal, e-fax, paper with cover letter; 277CA acceptance handling. Claim.MD as warm backup rail. |
| 4. Loop | Work every claim to closure | Timers per payer (from the directory); 276/277 status polling (no enrollment needed at most payers) as the **primary** adjudication signal; patient EOB vision parsing as the second (the payer always mails the patient an EOB on a non-assigned claim); 835/ERA only where the provider ERA-enrolls through us (exclusive per payer — never take a provider's existing ERA feed); denial-code (CARC/RARC) → action mapper; generated artifacts: status inquiry, corrected claim, medical-records response, first-level appeal, second-level appeal, state DOI / DOL complaint, misdirected-payment letter; escalation ladder with SLAs |
| 5. Experience | Show the loop | Patient timeline (mobile-first), provider confirm surface (SMS + magic link + optional portal), notifications (push/SMS/email, one per state change, never more), monthly "$ recovered" statement, deductible progress, public scorecard |
| 6. Money | Charge fairly, never hold funds | Fee event fires only on `paid`/`partially_paid`; card on file via Stripe; practice-sponsor plan; refunds are automatic reversals, not tickets |

### 3.4 Claim state machine

The MVP lifecycle (draft → submitted → acknowledged → paid | denied → appealed | info_requested → closed) expands to fourteen states. Each row is what the patient sees, what the engine does, and the timer that fires if nothing happens.

| State | Patient sees | Engine does | Timer |
|---|---|---|---|
| `draft` | "We read your superbill. Check 3 things." | Extraction, NPPES fill, eligibility 270/271, scrubber | — |
| `ready` | "Ready to send to Cigna. Estimated back: ~$126 in ~19 days." | Waits for one tap (or auto if autopilot on) | Timely-filing warning at T−30d |
| `submitted` | "Sent electronically to Cigna at 2:14 pm." | 837P out; watches for 999/277CA | 2 business days → `stalled` |
| `accepted` | "Cigna has it. Claim #… Typical: 19 days." | 277CA accepted; schedules 276 polls | Payer median + 7d → status inquiry |
| `rejected_front_end` | "Cigna's system bounced it (wrong member ID format). We fixed and resent." | Auto-correct from 277CA reason, resubmit | — |
| `in_adjudication` | "Being reviewed. Day 12 of ~19." | 276/277 every 7d; ETA updates | Payer 90th pct → `stalled` |
| `info_requested` | "Cigna wants session notes. We asked Dr. Lee. Nothing for you to do." | Generates records request to provider (magic link upload); tracks provider SLA | 10d → nudge provider; 20d → nudge patient |
| `stalled` | "Cigna is past its own window. We sent a formal inquiry today." | Status inquiry letter/portal message; logs for DOI | 15d → escalation; 30d → `escalated` |
| `escalated` | "We filed a complaint with the NY Dept. of Financial Services on your behalf. Here's the confirmation." | DOI/DOL complaint generated and sent | 30d → human review |
| `applied_to_deductible` | "Approved. $180 applied to your deductible ($1,420 left). No fee for this one." | 835 parsed; deductible tracker updated; **no charge** | — |
| `partially_paid` | "Cigna paid $84 of $200. Allowed $120 × 70%. Here's why." | Fee charged; allowed-amount table updated; checks for underpayment vs. plan terms → optional appeal | — |
| `paid` | "Paid: $126. Check mailed to you on 9/14." | Fee charged; misdirected-payment watch (if 835 payee ≠ patient) | 21d no confirmation → "did the check arrive?" |
| `denied` | "Denied: CO-197, no pre-authorization. This is usually winnable. Appeal in one tap." | CARC/RARC mapped; appeal drafted with the right template; patient approves | 180d appeal window countdown |
| `appealed` | "Appeal sent 9/16. Federal rules give Cigna 60 days to answer a post-service appeal." | Tracks statutory deadline; second-level or DOI if lost/ignored | Statutory window → `escalated` |
| `misdirected` | "Cigna paid Dr. Lee instead of you. We sent her the refund-to-patient letter." | Letter + provider magic link to confirm refund; provider SLA | 14d → nudge; 30d → human |
| `closed` | Summary card with total recovered, days, fee | Archive; feeds scorecard | — |

Follow-up rules carry over from `src/lib/followups.ts` (timely-filing T−30, inquiry +14, escalation +30, regulator +45, appeal 180d, info response) and become **payer-parameterized** instead of fixed.

### 3.5 Pricing

| Plan | Who pays | Price | When charged | Notes |
|---|---|---|---|---|
| Pay-when-paid | Patient | $9 flat per claim (first claim free) | Only on `paid` / `partially_paid` | $0 on deductible-only or denied. Cap: never more than 10% of the amount recovered. |
| Autopilot | Patient | $15/mo unlimited claims | Monthly | For weekly therapy; pauses automatically in months with no paid claims. |
| Practice Sponsor — Basic | Provider | $0 | — | Practice dashboard, referral link on superbills, free benefits checker + widget; the practice's patients stay on pay-when-paid. |
| Practice Sponsor — Starter | Provider | $59/mo, 25 accepted claims included, $3.50 per claim above | Monthly base; overage at month end | All the practice's patients file free. Per practice (Tax ID), unlimited clinicians. |
| Practice Sponsor — Growth | Provider | $149/mo, 60 accepted claims included, $3.00 overage | Same | Adds registration handling, records-request workflow. |
| Practice Sponsor — Group | Provider | $399/mo, 150 accepted claims included, $2.50 overage | Same | Groups of 4–15 clinicians; priority support. |
| Network / Embedded | Large groups, telehealth & DTC brands | Custom, 1,000+ accepted claims/mo commitment, $2.25/claim floor | Monthly invoice | Fertility, GLP-1/nutrition, pediatric therapy, functional medicine. |

Practice Sponsor metering (decided 9/17): a claim counts once, when the payer's 277CA accepts it; front-end rejections, duplicates, corrected claims, appeals and status inquiries never count. Monthly allowance, no rollover. Upgrade offered when base + overage exceeds the next tier two months running; downgrades take effect next cycle and claims already in the loop stay sponsored. Every tier clears the ~$1.65/claim cost to serve at 100% utilization (27–35% margin) and runs 55–60% at the typical 60%; the flat unlimited seat it replaces was Reimbursify's structural leak. Economics in `revenue-model-options.md`.

Why these numbers: Mentaya costs a weekly $200 client $40/mo from day one; Reimbursify $3.99 with no follow-up; Thrizer $1.40–$7 per paid claim after the therapist moved processors. At $9-when-paid, a weekly client pays ~$36/mo *only in months where they actually get money back* and $0 while meeting the deductible — cheaper than Mentaya in the worst case, and priced above Reimbursify because the loop is worth it. A 10% cap on recovery keeps the fee fair on low-allowed-amount payers. Unit economics: clearinghouse ~$0.50/claim round-trip incl. status/ERA, eligibility ~$0.10, vision extraction ~$0.05, Stripe ~$0.56 on $9 → ~85% gross margin per paid claim before support; the free deductible-only claims are the acquisition cost (~$0.65 each).

Decisions (9/17): Autopilot ships in v1. Practice Sponsor is tiered by accepted claims (above), not a flat per-clinician seat. Exact patient-side dollar figures are being set in a separate conversation; figures above are placeholders.

### 3.6 Trust surface

HIPAA BAA on signup; consent screen lists the exact fields sent to the payer (name, DOB, member ID, diagnosis, CPT, dates, charges) with a one-line "why" per field; no arbitration clause buried in the ToS; SOC 2 Type I within 12 months and published; PHI never in SMS bodies (SMS carries "Session on Tue 9/15 with your 3 pm client — reply YES" style prompts, no names or codes); public scorecard updated monthly.

---

## Part 4 — User journeys

### 4.1 Patient journey

**Stage 0 — Discovery.** Entry points: "how to file a superbill" search (Reimbursify's SEO territory, now contested), Thrizer's orphaned patients (told in Aug 2026 to "file with the carrier themselves"), provider referral link or QR on the superbill footer, app-store search. Landing page has one action: *Snap your superbill*. No account yet.

**Stage 1 — The 90-second wow (no account).** Camera opens. Superbill photographed. In under ten seconds the screen shows: provider name and NPI (from NPPES), 3 dates of service, CPT 90837, diagnosis F41.1, $200 × 3. Then: "Add your insurance card to see what you'd get back." Card photographed; 270/271 fires; result: "Cigna PPO · OON deductible $1,500, $1,320 left · after that, ~70% of allowed · Cigna's median: 19 days · First claim free." The patient has done nothing but take two photos. Mentaya's client cannot see any of this without their therapist doing setup; Reimbursify's user is still typing.

**Stage 2 — Setup (2 minutes, once).** Email/phone + passkey. Consent screen with field-by-field "what we send and why." E-sign the patient authorization (not an assignment of benefits — a *release* that lets us file on the patient's behalf; payment stays with the patient). Card on file with the pay-when-paid promise printed above the field: "We charge $9 only when Cigna pays you. Deductible months are free." Optional: "Where should Cigna send your check?" prompts the patient to set up direct deposit in the payer portal, with a deep link and per-payer instructions.

**Stage 3 — Submit.** One review screen, three things to confirm (dates, provider, charges). Tap *Send to Cigna*. Confetti is not the reward; the tracker is: "Sent electronically 2:14 pm. Cigna will acknowledge within 2 business days."

**Stage 4 — The live loop.** The claim is a package tracker: each state from §3.4 with a timestamp, a plain-English line, "what we're doing next," and an ETA that moves. Notifications only on state change. When something needs the patient (rare), it is a single button: *Approve appeal*, *Confirm check arrived*, *Add secondary insurance*. Denials show the CARC/RARC code, the translated reason, the historical win rate for that reason at that payer, and a drafted appeal. Every letter we send is attached in the timeline.

**Stage 5 — Money.** `paid` shows amount, allowed amount, coinsurance math, and the check-mailed date from the 835. If the payer paid the provider (AOB misdirection — Reimbursify's top complaint), the timeline shows the letter we sent the provider and a "provider confirmed refund" step. Fee receipt appears *under* the reimbursement line, never before it.

**Stage 6 — Recurring care.** After the second superbill from the same provider, the app offers *Autopilot*: forward superbills to `you@claims.<app>` or let your provider confirm sessions by text. Home screen becomes a dashboard: deductible progress bar, "$1,284 recovered this year," next expected payment, and a monthly statement PDF for taxes/HSA. Year-end: "Your deductible resets Jan 1 — the first ~7 sessions will apply to it; we'll file them free."

**Stage 7 — Bring your provider.** One tap sends the provider a magic link: "Ryan uses [app] to get reimbursed for your sessions. Reply YES after each session and their claims file automatically — no account, no cost." The provider becomes an accelerator without ever being a gate.

*Before/after on the moments that matter*

| Moment | Mentaya | Reimbursify | Ours |
|---|---|---|---|
| Time to first claim | Days (therapist signup, claim defaults, invite, card) | ~10 min of typing | < 90 s from photo, before creating an account |
| Cost before deductible is met | 5% per session | $3.99 per claim | $0 |
| What you see after submitting | "Submitted… around 30 days" | Whatever you typed in from your EOB | 14 states, live ETA, every letter |
| Denial | "Re-submitted" | "Call your insurer" | Reason + win rate + one-tap appeal |
| Payer ghosting | Nothing | Nothing | Formal inquiry → DOI complaint, automatically |
| Provider not enrolled | Blocked (or 10%) | Fine | Fine, and one tap to invite them |

### 4.2 Provider journey

Providers enter bottom-up (a patient invited them) or top-down (they found us). Both paths converge on the same principle: **the provider never does setup the patient's superbill already contains.**

**Stage 0 — Zero-account accelerator.** A patient's invite arrives by SMS/email with a magic link. The provider sees one screen: their name, NPI (pulled from the superbill and NPPES), the patient's first name, and a toggle: *Text me after each session; I reply YES.* No password, no W-9, no claim defaults — the CPT, diagnosis, fee, and POS came from the superbill they already produce. This is Mentaya's best feature with its setup cost deleted.

**Stage 1 — Light account (2 minutes).** When the provider wants more (a second patient, a dashboard), they claim the account: license(s) by state, practice address, EIN if group, taxonomy confirmed from NPPES. We pre-warn per payer: "Anthem BCBS requires non-par registration before paying; we'll prepare the packet — you'll e-sign a W-9 and upload your license." Registration becomes a tracked object with its own timeline and ETA, not an email thread.

**Stage 2 — Session triggers, any of them.** SMS "YES" (or "YES 2", "NO", "SKIP"); Friday digest for missed replies; Google/iCal sync with fuzzy patient matching and a "which patient?" prompt instead of a silent drop; forwarding rule from their EHR's superbill email; native SimplePractice/TherapyNotes/Jane integrations later. Whichever source fires first creates the claim; a second source confirms it rather than duplicating it.

**Stage 3 — Free benefits checker.** Name, DOB, member ID → deductible status, estimated reimbursement using *our learned allowed amounts* for that payer × CPT × ZIP, "sessions until deductible met," and the payer's median days-to-pay. Shareable link, iframe widget, Psychology Today snippet. Free — this is Mentaya's $29–39/mo product and Reimbursify's $59+/mo tier, offered as acquisition.

**Stage 4 — Practice dashboard.** Per patient: claim states, next action, and whether anything is waiting on the provider (records request, refund-to-patient confirmation). Per payer: median days, denial rate, registration status. Full CMS-1500 lines: add-on codes (96131/96137, 90785), units, modifiers (95/GT, 59), POS 02/10/11, supervising NPI for pre-licensed clinicians. Specialty templates for testing, PT/OT, SLP, RD.

**Stage 5 — Records requests without email.** When a payer asks for notes, the provider gets a magic link to upload directly; we validate the notes against the payer's checklist (name, DOB/member ID, DOS on every page, start/stop times, signature with credentials) before sending — turning Mentaya's "What to Include in Medical Records" article into a form.

**Stage 6 — Group practice.** Admin and member roles, invite clinicians, per-clinician triggers and fee schedules, admin can confirm on behalf of anyone, roster view of every patient's loop. Group EIN + NPI-2 handled once.

**Stage 7 — Sponsor.** *Make claims free for my patients* → Practice Sponsor tier sized to the practice's monthly accepted-claim volume; the dashboard shows accepted claims against the allowance and the overage or upgrade math. Existing patients' fees drop to $0 on the next claim; the provider's benefits widget and Psychology Today profile get a "we file your out-of-network claims for free" badge, which is the exact marketing asset Mentaya's therapists build themselves.

*Provider before/after*

| Moment | Mentaya | Ours |
|---|---|---|
| First claim setup | Register, add license, invite client, wait for card, set 5 claim defaults per client | Tap a link, toggle SMS on |
| Add-on codes / units | Not supported | Full line model |
| Payer registration | Email SSN + W-9 + CP-575; 2–4 weeks, no visibility | Pre-warned at eligibility; e-sign packet; tracked with ETA |
| Records request | Email exchange | Magic-link upload with checklist validation |
| Calendar sync | Exact full-name match or silent miss | Fuzzy match + "which patient?" prompt |
| Benefits checker | $29–39/mo | Free |
| Money | Payer may pay Mentaya; forwarded later | Payer pays the patient; provider never in the money path |

---

## Part 5 — Build order on the existing MVP

The MVP (`~/Desktop/superbill-claims`: Next.js 16, Drizzle/SQLite, Claude vision extraction, packet PDF, follow-up engine, letter drafting) already covers Intake-lite, Submission-manual, Loop-timers, and Experience-basic. Sequence:

**Phase 1 — Patient loop, electronic (the wedge).** Auth + multi-user + PHI encryption at rest. Live vision extraction exercised against 50 real superbills across specialties. Insurance card extraction. Payer directory table (payer ID, addresses, timely filing, non-par flag, paper-check flag, DOI contact) seeded for the top 25 commercial payers. Clearinghouse integration for 270/271, 837P (Accept Assignment = No), 999/277CA, 276/277, 835 — one vendor with a modern API rather than fax. Replace the fixed lifecycle with the 14-state machine and payer-parameterized timers. Pay-when-paid and Autopilot billing via Stripe with the fee event bound to `paid`/`partially_paid` (Autopilot: monthly, auto-paused in months with no paid claim). Zero-account provider magic link (SMS, no PHI in body) so the electronic path unlocks on the first claim. Mobile-first timeline UI. Public scorecard page (even with small n). Exit criterion: a stranger with a superbill from a provider we've never seen gets to `accepted` in under 5 minutes with zero typing.

**Phase 2 — Loop depth + recurring.** CARC/RARC → action mapper and appeal templates by denial family; DOI/DOL complaint generator with state-specific addresses; EOB vision parsing for payers that don't return 835 on non-assigned claims; misdirected-payment playbook; email-forward inbox per user; deductible tracker and annual statement; learned allowed-amount table. **PT + chiropractic** per §5.1: service-type eligibility, units/modifier line model, visit-cap tracking, MSK denial templates, provider-first onboarding for cash-PT and chiro practices.

**Phase 3 — Provider accelerator.** Zero-account SMS confirm via magic link (Twilio, no PHI in body); light provider account with NPPES prefill; registration-packet workflow; records-request upload with checklist; free benefits checker + widget; Practice Sponsor tiers with accepted-claim metering (count on 277CA, monthly allowance, overage invoice, upgrade prompt); full CMS-1500 line model and specialty templates.

**Phase 4 — Distribution.** Group practice roles; SimplePractice/TherapyNotes/Jane integrations (start with iCal + email-forward, add native when a partner asks); Network/embedded tier for telehealth and DTC brands; association channel deals (APA/AND/APTA private-practice sections).

### 5.1 Phase 2 specialties: PT and chiropractic — what changes

Both are musculoskeletal, both use timed codes with units and modifiers, both carry visit caps, and neither PT nor DC providers can opt out of Medicare. Chiro additionally inverts the therapy economics (low ticket, often no OON benefit, maintenance care excluded). They ship together in phase 2 because they share the same build: service-type-specific eligibility, a units/modifier line model, cap tracking, and a provider-first go-to-market. The table below is written for chiro; PT differences follow it.

| Area | Therapy default | Chiro adjustment |
|---|---|---|
| Eligibility (270/271) | Behavioral health OON deductible/coinsurance | Query service type 33 (chiropractic): does an OON chiro benefit exist at all, visit cap, visits remaining, whether maintenance/wellness care is excluded. If no OON chiro benefit → tell the patient before anything is filed; never file a $0 claim. |
| Claim lines | One line, 90837 | CMT 98940/98941/98942 with **AT** modifier and a subluxation diagnosis (M99.0x) as primary; same-day E/M with **-25**; therapeutic procedures (97110/97140/97012) with units and GP where required; X-rays. Diagnosis pointers per line. The scrubber blocks CMT without AT or without M99. |
| Denial families | Medical necessity, pre-auth | Maintenance care (CO-50 / N-codes), visit cap exceeded (CO-119), missing AT, non-covered service (CO-96), no OON benefit. Appeal templates for the first two; the rest are prevented at eligibility time. |
| Medicare | Providers can opt out; MA PPO handled as commercial | DCs must bill Medicare directly for CMT — Medicare patients are gated out at intake with a plain explanation. MA PPO OON still works. |
| Pricing | $9 pay-when-paid | Same, but the **10% cap on amount recovered** does the work: $30 back → $3 fee. Chiro is where the cap earns its place. Practice Sponsor (Group tier) is the primary chiro plan. |
| Go-to-market | Patient-first, provider invited | **Provider-first.** Chiro practices see 2–3 visits/week per patient, have front-desk staff, and run ChiroTouch/Jane/ChiroFusion; email-forward ingestion and bulk confirm land there first. The patient app is the tracker, not the acquisition surface. |
| Journey copy | "Sessions until deductible met" | "12 of 20 OON chiro visits left this year · maintenance care not covered · ~60% of allowed." Shown at benefits check and again before each claim past visit 15. |

**PT differences:** eligibility service type 30/PT (often a combined PT/OT/ST visit cap, e.g. 20–60 visits/yr); lines are timed codes in 15-minute units under the 8-minute rule (97110, 97140, 97530, 97161–97163 evals) with the GP modifier and KX past the Medicare threshold (irrelevant here since Medicare is gated out); plan-of-care and re-eval dates matter for medical-necessity denials; episodic (8–12 visits) rather than indefinite, so Autopilot pauses itself at discharge. Ticket $150–250 makes pay-when-paid viable without leaning on the cap. Cash-PT clinics run WebPT/Jane/Prompt; Jane and Prompt email superbills, WebPT exports them.

Ordering in `vertical-market-sizing.md` becomes: psychotherapy + psychiatry (launch) → PT + chiro (phase 2, provider-led) → pediatric SLP/OT → dietitians → functional med → DPC (never). The doc's core math still holds: patient-paid per-claim fees alone would not carry chiro; the cap plus the Sponsor plan is what makes it fit.

**Decisions log (2026-09-17):**
- Name: open.
- Clearinghouse: **Stedi** primary (self-serve, no minimum, ~$0.30/claim at launch volume, JSON 837P with explicit assignment fields, per-payer enrollment flags via API, unlimited providers). Claim.MD as warm backup. Full evaluation in `clearinghouse-vendor-evaluation.md`.
- Launch specialty: **psychotherapy + psychiatry** (same patient, same CMS-1500, same parity rails), with psychological testing supported at launch because the multi-line model already handles 96130/96131/96136/96137 — a marketing wedge against Mentaya, not a separate build. **PT and chiropractic are phase 2 (decided 9/17)**, both provider-led; see §5.1. See `vertical-market-sizing.md`.
- Fee numbers: separate conversation.
- Autopilot: ships in v1.
- **Practice Sponsor is tiered by accepted claims (decided 9/17):** Basic $0 · Starter $59/25 · Growth $149/60 · Group $399/150 · Network custom ≥ $2.25/claim; overage $3.50 / $3.00 / $2.50; metered on 277CA acceptance, per practice, unlimited clinicians. Replaces the flat $79 solo / $49-per-clinician seat. Revenue model comparison in `revenue-model-options.md`.

### Sources
- Project docs: `mentaya-competitive-swot.md`, `reimbursify-competitive-swot.md`, `thrizer-competitive-swot.md`, `superbill-claims-mvp.md`
- mentaya.com (home, therapists, patients, pricing, billing-and-claims, client-experience, partners, about-us, baa, terms, terms-for-management-services-agreement-2024; blog: "Mentaya vs. Thrizer vs. Reimbursify," "The full story behind Mentaya," de-paneling guide, allowed-amounts post)
- help.mentaya.com: Getting Started; Invite Your Clients; Benefits Calculator setup and accuracy; Automated Claim Submission; Billing Options; Getting an NPI; Multiple Licenses; Absorb Client Fee; Syncing Calendar (Google, iCal); Bulk submit; Personalize Links; Submit via Text; EHR; Managing Client Info; Group Practice Walkthrough; Practice Members; Disabling Members; Pricing; Who can use; Denials; HIPAA; Refunds; Pre-licensed; Insurance concerns; SCAs; Transition from insurance; Tricky billing; OON registration; Timely filing; Medical records; Payment rejected; Widget (WordPress, height); Quick Explanation; Client Experience; Explain to Clients; How it works for clients; Past Superbills; Therapist must be on Mentaya; Claim Status; Update Credit Card; Connecting with Provider; Understanding Reimbursement; OON benefits
- BBB profile and complaints (11/2025, 7/2026); Slashdot listing; Crunchbase (Zaya Health)
- Practice FAQ pages: Therapy Austin, Austin DBT, McNulty Counseling, Simplify Atlanta, Maple Leaf, Kindful Place, Aspire Counseling, Gracefully Rooted, Mind Money Balance, Goodman Creatives, CPH Insurance
- Podcasts: Group Practice Exchange 234; Productive Therapist; Private Practice Startup 342; All Things Private Practice 93; Money Skills for Therapists; Testing Psychologist 482 (add-on code comments)
- Competitor critiques: Thrizer "Thrizer, Reimbursify, Mentaya or Advekit" (Feb 2024); docs.thrizer.com compare; reimbursify.com/why-reimbursify; superbilled.com/competitors
