"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/app/auth-client";

export function AddPasskey() {
  const router = useRouter();
  const [problem, setProblem] = useState(false);

  async function add() {
    setProblem(false);
    const result = await authClient.passkey.addPasskey();
    if (result?.error) return setProblem(true);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button className="btn-secondary" type="button" onClick={add}>Add a passkey</button>
      {problem && <p className="text-sm text-amber-900" role="alert">That didn&apos;t go through. One more try?</p>}
    </div>
  );
}

export function RemovePasskey({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="text-sm text-stone-600 underline hover:text-stone-900"
      type="button"
      onClick={async () => {
        await authClient.passkey.deletePasskey({ id });
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="btn-secondary"
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
