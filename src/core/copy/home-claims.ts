import { formatUsd, PRICING } from "../billing/pricing";
import { HOME, JOIN_BETA, TALK_TO_US } from "./home";

// Every promise the homepage makes, and what proves it. A proof names a test file and the slice that owns it:
// this slice's tests by "file > test name" (they exist now), later slices' by the file their acceptance names in
// docs/sprint-tasks.md. Anything we can't prove yet, or that Ryan still has to decide, is flagged-for-Ryan.
// home-claims.test.ts fails on any sentence on the page that is in neither this map nor LABELS.
export type Proof = { slice: string; test: string };
export type Claim = { proof: Proof[] } | { flag: "flagged-for-Ryan"; why: string };

const p = (slice: string, test: string): Proof => ({ slice, test });
const flag = (why: string): Claim => ({ flag: "flagged-for-Ryan", why });

const PRICE_FROM_CONFIG = p("S11c", "src/core/copy/pricing-grep.test.ts > every price and trial length on the page renders from PRICING");
const NO_PER_CLAIM = p("S11c", "src/core/copy/pricing-grep.test.ts > nothing is priced by the claim in src/ or content/");
const BAA_ON_EVERY_PLAN = p("S11c", "src/core/copy/banned-patterns.test.ts > 'Signed BAA on every plan' is on the homepage");
const GROUPS = "Groups are sold by hand at launch: there is no practice billing, shared formats or seat management in P0. Keep, reword or drop?";
const UNLIMITED = "D5 (Oct 4): recording costs about $0.10 a minute, so 'Unlimited' depends on whether recorded hours are capped (D2 item 10, S28b limits).";

const d = PRICING.trialDays;

export const HOME_CLAIMS: Record<string, Claim> = {
  [HOME.banner.text]: { proof: [PRICE_FROM_CONFIG, p("N6", "entitlements.test.ts"), p("N6", "billing.test.ts")] },
  "Talk through the session. We'll handle the paperwork.": { proof: [p("N13", "e2e/record.spec.ts"), p("S12", "e2e/m1-thin-path.spec.ts")] },
  [HOME.hero.lead]: { proof: [p("N13", "e2e/record.spec.ts"), p("N15", "letters.test.ts"), p("S13", "poll-timers.test.ts"), p("S12", "e2e/m1-thin-path.spec.ts")] },
  "No card needed. Signed BAA on every plan.": { proof: [p("N6", "entitlements.test.ts"), BAA_ON_EVERY_PLAN, p("N5", "clinician.test.ts")] },
  "Drafted from 8 of your notes. You signed it in one tap.": { proof: [p("N15", "sources.test.ts"), p("N15", "letters.test.ts")] },
  "Stop charting.": { proof: [p("N9b", "e2e/note.spec.ts")] },
  "Stop writing letters.": { proof: [p("N15", "letters.test.ts")] },
  "Keep your clients.": { proof: [p("S12", "e2e/m1-thin-path.spec.ts")] },
  [HOME.built.lead]: { proof: [p("N13", "e2e/record.spec.ts"), p("N13", "e2e/dictate.spec.ts"), p("N8", "captures.test.ts"), p("S5", "scans.test.ts")] },
  [HOME.built.cards[0].body]: flag("'or on video' promises telehealth capture, which is P1 (docs/spec.html:369; D2 item 10)."),
  [HOME.built.cards[1].body]: flag("Superbill scanning moved to P1 with S4's extraction; at launch the phone scans insurance cards (S5) and insurer letters (S16) only."),
  [HOME.built.cards[2].body]: { proof: [p("N15", "letters.test.ts"), p("N15", "citations.test.ts")] },
  [HOME.how.lead]: { proof: [p("N13", "e2e/record.spec.ts"), p("S12", "e2e/m1-thin-path.spec.ts")] },
  "Recorded in the room on your phone.": { proof: [p("N13", "e2e/record.spec.ts")] },
  "Audio deleted once your note is written.": { proof: [p("N12", "no-audio.test.ts")] },
  "Dictated after the session.": { proof: [p("N13", "e2e/dictate.spec.ts")] },
  "Turned into a full DAP note.": { proof: [p("N13", "e2e/dictate.spec.ts")] },
  "Typed between sessions.": { proof: [p("N8", "captures.test.ts")] },
  "Same finished note.": { proof: [p("N9b", "e2e/note.spec.ts")] },
  "Plan details filled in. The photo is deleted.": { proof: [p("S5", "scans.test.ts"), p("S5", "scan-storage.test.ts")] },
  "Nothing to type.": { proof: [p("S5", "scans.test.ts")] },
  [HOME.how.steps[0].body]: { proof: [p("N13", "e2e/record.spec.ts"), p("N13", "e2e/dictate.spec.ts")] },
  [HOME.how.steps[1].body]: { proof: [p("N9a", "note-model.test.ts"), p("N9b", "e2e/note.spec.ts")] },
  [HOME.how.steps[2].body]: { proof: [p("N10", "file-note.test.ts"), p("S13", "poll-timers.test.ts")] },
  "Leave on time.": { proof: [p("N9b", "e2e/note.spec.ts")] },
  "Proof, already written.": { proof: [p("N15", "letters.test.ts")] },
  [HOME.why.letters.body]: { proof: [p("N10", "no-insurer-traffic.test.ts"), p("N9b", "traffic.test.ts")] },
  "Clients get paid back.": { proof: [p("S12", "e2e/m1-thin-path.spec.ts")] },
  "No per-claim fees.": { proof: [NO_PER_CLAIM] },
  [HOME.why.price.body]: { proof: [PRICE_FROM_CONFIG, p("N6", "entitlements.test.ts"), p("N6", "billing.test.ts")] },
  "Your sessions stay yours.": { proof: [p("S12", "marker.test.ts"), p("N9b", "marker.test.ts")] },
  [HOME.security.qa[0].a]: { proof: [BAA_ON_EVERY_PLAN, p("N5", "clinician.test.ts")] },
  [HOME.security.qa[1].a]: { proof: [p("N12", "no-audio.test.ts"), p("S5", "scan-storage.test.ts")] },
  [HOME.security.qa[2].a]: { proof: [p("S4", "bedrock.test.ts"), p("S21a", "infra/stack.test.ts")] },
  [HOME.security.qa[3].a]: { proof: [p("S12", "marker.test.ts"), p("N9b", "marker.test.ts")] },
  "No card needed.": { proof: [p("N6", "entitlements.test.ts")] },
  "Every feature": { proof: [p("N6", "entitlements.test.ts")] },
  "Unlimited notes": flag(UNLIMITED),
  "Signed BAA": { proof: [BAA_ON_EVERY_PLAN, p("N5", "clinician.test.ts")] },
  "Cancel anytime.": { proof: [p("N6", "entitlements.test.ts"), p("N6", "e2e/billing.spec.ts")] },
  "Unlimited notes and dictation": flag(UNLIMITED),
  "Phone app with scanning": { proof: [p("S18a", "e2e/pwa.spec.ts"), p("S5", "scans.test.ts")] },
  "Necessity and appeal letters": { proof: [p("N15", "letters.test.ts"), p("S17", "appeal-draft.test.ts")] },
  "Clients' claims filed free for them": { proof: [NO_PER_CLAIM, p("N6", "billing.test.ts")] },
  "Works with any EHR": { proof: [p("N9b", "e2e/note.spec.ts")] },
  "Priced by practice size.": flag(GROUPS),
  "One bill for the practice": flag(GROUPS),
  "Shared note formats": flag(GROUPS),
  "Add and remove clinicians": flag(GROUPS),
  [HOME.faq.items[0].a]: { proof: [p("N9b", "e2e/note.spec.ts")] },
  [HOME.faq.items[1].a]: { proof: [p("N8", "captures.test.ts"), p("N13", "e2e/record.spec.ts")] },
  [HOME.faq.items[2].a]: { proof: [NO_PER_CLAIM, p("N6", "billing.test.ts")] },
  [HOME.faq.items[3].a]: { proof: [p("S8", "clm-invariants.property.test.ts")] },
  [HOME.close.lead]: { proof: [PRICE_FROM_CONFIG, p("N6", "entitlements.test.ts")] },
  [HOME.footer.tagline]: flag("'bring the money back' can read as Ferry handling the money; the payer pays the client and we never touch it (FAQ). Keep as a metaphor, or reword?"),
};

// Text on the page that promises nothing: navigation, buttons, headings, questions, and the sample client's cards.
export const LABELS = new Set<string>([
  "Ferry",
  ...HOME.nav.map((n) => n.label),
  HOME.logIn.label,
  HOME.startFree,
  JOIN_BETA.label,
  TALK_TO_US.label,
  HOME.hero.primary,
  HOME.hero.secondary.label,
  ...Object.values(HOME.hero.note),
  HOME.hero.letter.label,
  HOME.hero.claim.label,
  HOME.hero.claim.amount,
  "Sent across",
  "On its way",
  "Snapped and sent",
  "Your insurer has it",
  "Money comes back",
  HOME.built.title,
  ...HOME.built.cards.map((c) => c.title),
  HOME.how.title,
  ...HOME.how.modes.flatMap((m) => [m.label, m.title]),
  "48 min",
  "Saved",
  ...HOME.how.steps.flatMap((s) => [s.num, s.title]),
  HOME.why.title,
  HOME.why.notes.label,
  ...HOME.why.notes.formats,
  HOME.why.letters.label,
  HOME.why.claims.label,
  HOME.why.price.label,
  HOME.security.lead,
  ...HOME.security.qa.map((q) => q.q),
  HOME.pricing.title,
  HOME.pricing.trial.title,
  HOME.pricing.trial.price,
  `for ${d} days`,
  HOME.pricing.membership.title,
  HOME.pricing.membership.badge,
  formatUsd(PRICING.monthlyCents),
  HOME.pricing.membership.unit,
  HOME.pricing.groups.title,
  HOME.pricing.groups.price,
  HOME.faq.title,
  ...HOME.faq.items.map((i) => i.q),
  HOME.close.title,
  ...HOME.footer.columns.flatMap((c) => [c.title, ...c.links.map((l) => l.label)]),
  HOME.footer.copyright,
]);
