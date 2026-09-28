import { parseAllowlist, type SignupDecision, signupDecision } from "@/core/signup";
import { deployTier, type Env, isPrelaunch } from "./deploy";

// Who may start a clinician account in this deployment (core/signup.ts has the rule).
export function signupPolicy(email: string, env: Env = process.env): SignupDecision {
  return signupDecision({ tier: deployTier(env), prelaunch: isPrelaunch(env), allowlist: parseAllowlist(env.BETA_ALLOWLIST), openSignup: env.FERRY_OPEN_SIGNUP === "1" }, email);
}
