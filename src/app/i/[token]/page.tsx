import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your invitation" };

// Stub until invites land (N7a). It never reads or echoes the token.
export default function InvitePage() {
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-10">
      <h1 className="font-display text-h1">You have an invitation waiting.</h1>
      <p className="text-secondary text-slate">Invitations open here very soon. Nothing is needed from you yet.</p>
    </div>
  );
}
