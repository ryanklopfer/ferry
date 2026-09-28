import { redirect } from "next/navigation";
import { type Role, requireClient, requireClinician, requireSignedIn } from "@/server/auth/ctx";
import { firstStaleMembership, staleConsents } from "@/server/services/consents";

const HOME: Record<Role, string> = { clinician: "/app", client: "/c", staff: "/ops", pending: "/start" };

// The installed app and every sign-in land here (manifest start_url), and each role goes to its own area. A consent
// signed to an earlier version of its text sends the signer to re-consent first.
export default async function HomePage() {
  const { role } = await requireSignedIn();
  if (role === "clinician" && (await staleConsents(await requireClinician())).length) redirect(`/app/reconsent?next=${HOME.clinician}`);
  if (role === "client") {
    const m = await firstStaleMembership(await requireClient());
    // Back through /home, so each clinician's stale consents are asked for in turn.
    if (m) redirect(`/c/reconsent?m=${m}&next=/home`);
  }
  redirect(HOME[role]);
}
