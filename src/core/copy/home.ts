import { BRAND } from "../brand";
import { countWord, formatUsd, PRICING } from "../billing/pricing";
import { contactMailto } from "../site";

// docs/spec.html #screen-1, in page order (home-copy.test.ts holds the page to it). Prices and the trial length
// come only from PRICING. Changes against the spec go in AMENDMENTS below, never silently here.
const price = formatUsd(PRICING.monthlyCents);
const days = PRICING.trialDays;
const trialLabel = `Start free for ${days} days`;

export type Link = { label: string; href: string };

// "Start free" and every trial button open the beta email while the site is prelaunch (FERRY_PRELAUNCH).
export const JOIN_BETA: Link = { label: "Join the beta", href: contactMailto(`Join the ${BRAND.name} beta`) };
export const TALK_TO_US: Link = { label: "Talk to us", href: contactMailto(`${BRAND.name} for groups`) };
export const trialCta = (label: string, prelaunch: boolean): Link => (prelaunch ? JOIN_BETA : { label, href: "/start" });

export const HOME = {
  banner: { text: `Free for ${days} days, then ${price} a month. Your clients file free.`, href: "#pricing" },
  nav: [
    { label: "How it works", href: "/#how" },
    { label: "Security", href: "/#security" },
    { label: "Pricing", href: "/#pricing" },
    { label: "For groups", href: "/#pricing" },
  ],
  logIn: { label: "Log in", href: "/sign-in" },
  startFree: "Start free",
  hero: {
    title: "Talk through the session. We'll handle the paperwork.",
    lead: `${BRAND.name} writes your notes as you speak, drafts the letters insurers ask for, and files every client's out-of-network claim until it's paid.`,
    primary: trialLabel,
    secondary: { label: "See how it works", href: "#how" },
    fine: "No card needed. Signed BAA on every plan.",
    note: { label: "DAP note, ready", quote: '"Sleeping 6 hours most nights, up from 4."', meta: "Jordan · Today, 3:00 pm" },
    letter: { label: "Necessity letter", meta: "Drafted from 8 of your notes. You signed it in one tap." },
    claim: { label: "Coming back to Jordan", amount: "$126.00" },
  },
  promises: ["Stop charting.", "Stop writing letters.", "Keep your clients."],
  built: {
    title: "Built for how you actually work.",
    lead: `Speak it, dictate it, type it, or scan it. ${BRAND.name} turns it into finished paperwork.`,
    cards: [
      { title: "Your note, in your format", body: "Record in the room or on video, or talk for a minute after. SOAP, DAP, BIRP or intake, in your words." },
      { title: "Scan instead of type", body: "Point your phone at an insurance card, a superbill or an insurer's letter. The details fill in on their own." },
      { title: "Letters from your own notes", body: "When an insurer asks why care is needed, the letter is already drafted. You read it and sign." },
    ],
  },
  how: {
    title: "How it works",
    lead: "Four ways in. One finished note, and a client who gets paid back.",
    label: "Ways to capture",
    modes: [
      { value: "live", label: "Live session", title: "Jordan · Today, 3:00 pm", tag: "48 min", meta: "Recorded in the room on your phone.", notice: "Audio deleted once your note is written." },
      { value: "dictate", label: "Dictate a summary", title: '"Jordan slept better. Two panic episodes at work. Keep weekly CBT."', meta: "Dictated after the session.", notice: "Turned into a full DAP note." },
      { value: "type", label: "Type rough notes", title: "sleep better, 2 panic at work, cont CBT", meta: "Typed between sessions.", notice: "Same finished note." },
      { value: "scan", label: "Scan a document", title: "Cigna PPO card · Jordan", saved: "Saved", meta: "Plan details filled in. The photo is deleted.", notice: "Nothing to type." },
    ],
    steps: [
      { num: "01", title: "Talk", body: "Record the session, or dictate a summary once your client leaves." },
      { num: "02", title: "Approve", body: "Your note arrives with suggested codes. Fix any line, then copy it to your EHR." },
      { num: "03", title: "We take it from there", body: "Your client's claim goes out that day, and we chase it until it's paid." },
    ],
  },
  why: {
    title: `Why clinicians hand it to ${BRAND.name}`,
    notes: { label: "Notes", title: "Leave on time.", formats: ["SOAP", "DAP", "BIRP", "Intake"] },
    letters: { label: "Letters", title: "Proof, already written.", body: "Nothing goes to an insurer until you approve it." },
    claims: { label: "Claims", title: "Clients get paid back." },
    price: { label: "Price", title: "No per-claim fees.", body: "One membership covers every note, letter and claim. Your clients never pay us." },
  },
  security: {
    title: "Your sessions stay yours.",
    lead: "Built for therapy, where privacy is the whole point.",
    qa: [
      { q: "Is there a BAA?", a: "Yes. You sign it when you join, on every plan." },
      { q: "Do you keep recordings or scans?", a: "No. Audio and photos are deleted once the details are saved." },
      { q: "Do you train AI on my notes?", a: "Never. Your notes are used only for your notes and letters." },
      { q: "Who sees my notes?", a: "Only you. Clients see their claim's progress, never your notes." },
    ],
  },
  pricing: {
    title: "One price. Everything included.",
    trial: { title: "Free trial", price: "$0", unit: `for ${days} days`, meta: "No card needed.", features: ["Every feature", "Unlimited notes", "Signed BAA"], cta: "Start free" },
    membership: {
      title: "Membership",
      badge: "Most popular",
      price,
      unit: "a month",
      meta: "Cancel anytime.",
      features: ["Unlimited notes and dictation", "Phone app with scanning", "Necessity and appeal letters", "Clients' claims filed free for them", "Works with any EHR"],
      cta: trialLabel,
    },
    groups: { title: "Groups", price: "Custom", meta: "Priced by practice size.", features: ["One bill for the practice", "Shared note formats", "Add and remove clinicians"] },
  },
  faq: {
    title: "Questions",
    items: [
      { q: "Does it work with my EHR?", a: "Yes. Copy the finished note into SimplePractice, TherapyNotes, or any other EHR in one tap." },
      { q: "What if a client doesn't want to be recorded?", a: "Then don't record. Dictate a summary after the session, or type rough notes, and you get the same finished note." },
      { q: "Do my clients pay anything?", a: "No. Your membership covers filing and following up on every client's claim." },
      { q: "Who gets the insurance money?", a: "Your client. We file under your NPI with your client as the one who gets paid. We never touch the money." },
    ],
  },
  close: { title: "Leave on time tonight.", lead: `${countWord(days)} days free. No card needed.`, cta: trialLabel },
  footer: {
    tagline: "We carry the paperwork across and bring the money back.",
    columns: [
      { title: "Product", links: [{ label: "How it works", href: "/#how" }, { label: "Pricing", href: "/#pricing" }, { label: "Security", href: "/#security" }] },
      {
        title: "Who it's for",
        links: [
          { label: "Therapists", href: "/#pricing" },
          { label: "Psychiatrists", href: "/#pricing" },
          { label: "Group practices", href: "/#pricing" },
          { label: "Clients", href: "/for-clients" },
        ],
      },
      { title: "Legal", links: [{ label: "Privacy", href: "/legal/privacy" }, { label: "Terms", href: "/legal/terms" }] },
    ],
    copyright: `© 2026 ${BRAND.name} Health`,
  },
} as const;

// Wording that differs from docs/spec.html #screen-1, each with who decided it. `spec` is replaced by `page` in the
// spec's text before home-copy.test.ts compares it with the rendered homepage.
export const AMENDMENTS: { spec: string; page: string; why: string }[] = [
  {
    spec: "Group practices Legal",
    page: "Group practices Clients Legal",
    why: "S11c scope (D3): the footer links to /for-clients, the only way a non-member's client reaches the invite-your-therapist link.",
  },
];
