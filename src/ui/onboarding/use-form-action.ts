"use client";

import { useActionState } from "react";
import type { FormState } from "./form-state";

// useActionState, plus a count of answers. Keying the form on it remounts the fields with the values the action sent
// back: React's own reset after an action would put every select back to the option it first rendered with.
export function useFormAction(action: (state: FormState, fd: FormData) => Promise<FormState>, values: Record<string, string>) {
  return useActionState(async (prev: FormState & { answers: number }, fd: FormData) => ({ ...(await action(prev, fd)), answers: prev.answers + 1 }), { problem: null, fields: [], values, answers: 0 });
}
