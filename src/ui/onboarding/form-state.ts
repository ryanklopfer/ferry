import type { OnboardingProblem } from "@/core/copy/onboarding";

// What an onboarding or account form action hands back when the clinician needs to fix something.
export type FormState = { problem: OnboardingProblem | null; fields: string[]; values: Record<string, string> };
