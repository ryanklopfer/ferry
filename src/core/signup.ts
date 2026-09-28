import { JOIN_BETA } from "./copy/home";
import { ONBOARDING } from "./copy/onboarding";

export type SignupTier = "dev" | "prelaunch" | "staging" | "prod";

export type SignupDecision = { kind: "open" } | { kind: "refused"; message: string } | { kind: "mailto"; href: string };

export type SignupSettings = { tier: SignupTier; prelaunch: boolean; allowlist: readonly string[]; openSignup: boolean };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// BETA_ALLOWLIST: emails separated by commas, spaces or newlines.
export const parseAllowlist = (value: string | undefined): string[] => (value ?? "").split(/[\s,;]+/).map(normalizeEmail).filter(Boolean);

// Who may start a clinician account. Prelaunch has no sign-up at all (Start free opens the beta email); dev and
// staging are open; prod admits only the beta allow-list (F15) until FERRY_OPEN_SIGNUP=1.
export function signupDecision(s: SignupSettings, email: string): SignupDecision {
  if (s.prelaunch || s.tier === "prelaunch") return { kind: "mailto", href: JOIN_BETA.href };
  if (s.tier !== "prod" || s.openSignup) return { kind: "open" };
  return s.allowlist.includes(normalizeEmail(email)) ? { kind: "open" } : { kind: "refused", message: ONBOARDING.signup.betaOnly };
}
