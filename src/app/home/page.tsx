import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type Role, requireClient, requireClinician, requireSignedIn } from "@/server/auth/ctx";
import { INTENT_COOKIE } from "@/server/auth/intent";
import { signupIntentValid } from "@/server/services/clinician";
import { firstStaleMembership, staleConsents } from "@/server/services/consents";

const HOME: Record<Role, string> = { clinician: "/app", client: "/c", staff: "/ops", pending: "/start" };

// The installed app and every sign-in land here (manifest start_url), and each role goes to its own area. A consent
// signed to an earlier version of its text sends the signer to re-consent first; a pending user part-way through
// Start free goes back to onboarding.
export default async function HomePage() {
  const { role } = await requireSignedIn();
  if (role === "pending" && (await signupIntentValid((await cookies()).get(INTENT_COOKIE)?.value))) redirect("/app/welcome");
  if (role === "clinician" && (await staleConsents(await requireClinician())).length) redirect(`/app/reconsent?next=${HOME.clinician}`);
  if (role === "client") {
    const m = await firstStaleMembership(await requireClient());
    // Back through /home, so each clinician's stale consents are asked for in turn.
    if (m) redirect(`/c/reconsent?m=${m}&next=/home`);
  }
  redirect(HOME[role]);
}
