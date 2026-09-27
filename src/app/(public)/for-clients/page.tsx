import type { Metadata } from "next";

export const metadata: Metadata = { title: "For clients" };

// Placeholder until S11c writes this page (D3). It links nowhere: clients join only through an invite.
export default function ForClientsPage() {
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-10">
      <h1 className="text-xl font-semibold">Your clinician brings you aboard.</h1>
      <p className="text-sm text-stone-600">When they invite you, the link in their message opens everything here. There&apos;s nothing to set up before then.</p>
    </div>
  );
}
