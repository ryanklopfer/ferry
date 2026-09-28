"use client";

import { useActionState } from "react";
import { ONBOARDING } from "@/core/copy/onboarding";
import { ButtonLink } from "@/ui/button";
import { Card } from "@/ui/card";
import { Field } from "@/ui/field";
import { Notice } from "@/ui/notice";
import { SubmitButton } from "@/ui/submit-button";
import { type StartState, startClinicianSignupAction } from "./actions";

const copy = ONBOARDING.signup;

// Start free asks for an email and nothing else: no name, no card, no password.
export function ClinicianSignupForm() {
  const [state, action] = useActionState(startClinicianSignupAction, { kind: "idle" } as StartState);

  if (state.kind === "sent") {
    return (
      <div role="status">
        <Card>
          <p className="font-display text-h3">{copy.sentTitle}</p>
          <p className="text-secondary text-slate">{copy.sent(state.to)}</p>
        </Card>
      </div>
    );
  }
  if (state.kind === "mailto") {
    return (
      <ButtonLink variant="primary" href={state.href}>
        Join the beta
      </ButtonLink>
    );
  }
  return (
    <div className="space-y-4">
      {state.kind === "refused" && <Notice role="status">{state.message}</Notice>}
      {state.kind === "problem" && <Notice role="alert">{copy.problem}</Notice>}
      <form action={action} className="flex flex-col gap-4 rounded-card bg-white p-5.5">
        <Field label={copy.emailLabel} name="email" type="email" autoComplete="email" required maxLength={254} />
        <SubmitButton pending="Sending…">{copy.send}</SubmitButton>
      </form>
    </div>
  );
}
