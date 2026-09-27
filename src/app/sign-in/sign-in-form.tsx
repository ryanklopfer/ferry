"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/app/auth-client";

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
      <div className="card space-y-1" role="status">
        <p className="font-medium">Check your email.</p>
        <p className="text-sm text-stone-600">We sent a link to {status.to}. It works once and lasts 15 minutes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {linkProblem && status.kind === "idle" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          That link was already used or ran out of time. We&apos;ll send you a fresh one.
        </p>
      )}
      {status.kind === "problem" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          That didn&apos;t go through. One more try?
        </p>
      )}
      <form action={sendLink} className="card space-y-3">
        <div>
          <label className="label" htmlFor="email">Your email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email webauthn" required />
        </div>
        <button className="btn-primary w-full" type="submit" disabled={status.kind === "busy"}>Send me a link</button>
      </form>
      <button className="btn-secondary w-full" type="button" onClick={usePasskey} disabled={status.kind === "busy"}>
        Use a passkey instead
      </button>
    </div>
  );
}
