"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/app/auth-client";
import { clearAppCaches } from "@/ui/pwa";
import { Button } from "@/ui/button";

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
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" fill="blush" onClick={add}>
        Add a passkey
      </Button>
      {problem && (
        <p className="text-caption text-danger" role="alert">
          That didn&apos;t go through. One more try?
        </p>
      )}
    </div>
  );
}

export function RemovePasskey({ id }: { id: string }) {
  const router = useRouter();
  return (
    <Button
      variant="tertiary"
      onClick={async () => {
        await authClient.passkey.deletePasskey({ id });
        router.refresh();
      }}
    >
      Remove
    </Button>
  );
}

// A full page load afterwards, not a client-side push, so no page data from the session stays in memory either.
export function SignOut() {
  return (
    <Button
      variant="secondary"
      className="self-start"
      onClick={async () => {
        await authClient.signOut();
        await clearAppCaches();
        window.location.replace("/sign-in");
      }}
    >
      Sign out
    </Button>
  );
}
