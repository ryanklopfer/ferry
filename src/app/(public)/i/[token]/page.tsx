import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your invitation" };

// Stub until invites land (N7a). It never reads or echoes the token.
export default function InvitePage() {
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-10">
      <h1 className="text-xl font-semibold">You have an invitation waiting.</h1>
      <p className="text-sm text-stone-600">Invitations open here very soon. Nothing is needed from you yet.</p>
    </div>
  );
}
