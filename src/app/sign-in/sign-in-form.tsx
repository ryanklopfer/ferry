"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/app/auth-client";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Field } from "@/ui/field";
import { Notice } from "@/ui/notice";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "sent"; to: string } | { kind: "problem" };

export function SignInForm({ linkProblem }: { linkProblem: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function sendLink(formData: FormData) {
    const to = String(formData.get("email") ?? "").trim();
    if (!to) return;
    setStatus({ kind: "busy" });
    const { error } = await authClient.signIn.magicLink({ email: to, callbackURL: "/home", errorCallbackURL: "/sign-in" });
    setStatus(error ? { kind: "problem" } : { kind: "sent", to });
  }

  async function usePasskey() {
    setStatus({ kind: "busy" });
    const result = await authClient.signIn.passkey();
    if (result?.error) return setStatus({ kind: "problem" });
    router.push("/home");
    router.refresh();
  }

  if (status.kind === "sent") {
    return (
      <div role="status">
        <Card>
          <p className="font-display text-h3">Check your email.</p>
          <p className="text-secondary text-slate">We sent a link to {status.to}. It works once and lasts 15 minutes.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {linkProblem && status.kind === "idle" && (
        <Notice role="status">That link was already used or ran out of time. We&apos;ll send you a fresh one.</Notice>
      )}
      {status.kind === "problem" && (
        <Notice role="alert">That didn&apos;t go through. One more try?</Notice>
      )}
      <form action={sendLink} className="flex flex-col gap-4 rounded-card bg-white p-5.5">
        <Field label="Your email" name="email" type="email" autoComplete="email webauthn" required />
        <Button variant="primary" type="submit" className="w-full" disabled={status.kind === "busy"}>
          Send me a link
        </Button>
      </form>
      <Button variant="secondary" className="w-full" onClick={usePasskey} disabled={status.kind === "busy"}>
        Use a passkey instead
      </Button>
    </div>
  );
}
