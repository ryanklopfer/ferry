import type { Metadata } from "next";
import { FOR_CLIENTS } from "@/core/copy/for-clients";
import { Card } from "@/ui/card";
import { ShareInvite } from "@/ui/share-invite";

export const metadata: Metadata = { title: "For clients" };

// D3: clients join through their clinician's invite; a client whose therapist isn't a member gets the share
// action and nothing else. No sign-up, no form, nothing stored.
export default function ForClientsPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pt-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-h1">{FOR_CLIENTS.title}</h1>
        <p className="text-secondary text-slate">{FOR_CLIENTS.lead}</p>
      </div>
      <Card>
        <h2 className="font-display text-h3">{FOR_CLIENTS.inviteTitle}</h2>
        <p className="text-secondary text-slate">{FOR_CLIENTS.inviteLead}</p>
        <ShareInvite label={FOR_CLIENTS.share} />
        <p className="text-caption text-slate">{FOR_CLIENTS.fine}</p>
      </Card>
    </div>
  );
}
