"use client";

import { ONBOARDING } from "@/core/copy/onboarding";
import { COMMON_BEHAVIORAL_CODES } from "@/core/fee-schedule";
import { Card } from "../card";
import { Input } from "../field";
import { Notice } from "../notice";
import { SubmitButton } from "../submit-button";
import type { FormState } from "./form-state";
import { useFormAction } from "./use-form-action";

// One dollar amount per code, in our own words. Blank means the clinician doesn't bill that code.
export function FeesForm({ action, initial, submit }: { action: (state: FormState, fd: FormData) => Promise<FormState>; initial: Record<string, string>; submit: string }) {
  const [state, formAction] = useFormAction(action, initial);
  return (
    <form key={state.answers} action={formAction} className="flex flex-col gap-6">
      {state.problem && <Notice role="alert">{ONBOARDING.problems[state.problem]}</Notice>}
      <Card as="section">
        <ul className="flex flex-col gap-3">
          {COMMON_BEHAVIORAL_CODES.map(({ code, label }) => {
            const id = `fee-${code}`;
            return (
              <li key={code} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <label htmlFor={id} className="min-w-0 flex-1 text-body text-navy">
                  <span className="font-semibold">{label}</span> <span className="text-caption text-slate">{code}</span>
                </label>
                <div className="flex w-36 items-center gap-2">
                  <span aria-hidden="true" className="text-body font-semibold text-slate">
                    $
                  </span>
                  <Input id={id} name={`fee:${code}`} defaultValue={state.values[code] ?? ""} inputMode="decimal" maxLength={10} invalid={state.fields.includes(code)} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <div className="self-start">
        <SubmitButton pending="Saving…">{submit}</SubmitButton>
      </div>
    </form>
  );
}
