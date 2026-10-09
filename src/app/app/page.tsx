import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClinician } from "@/server/auth/ctx";
import { onboardingStep } from "@/server/services/clinician";
import { staleConsents } from "@/server/services/consents";

// Placeholder until the client list (N7a). A clinician who hasn't finished onboarding finishes it first; one whose
// agreement went stale since re-consents first, as at sign-in (/home).
export default async function ClinicianHome() {
  const ctx = await requireClinician();
  if ((await onboardingStep(ctx)) !== "done") redirect("/app/welcome");
  if ((await staleConsents(ctx)).length) redirect("/app/reconsent?next=/app");
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-10">
      <h1 className="font-display text-h1">Your clients</h1>
      <p className="text-secondary text-slate">Your clients will show up here.</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-secondary font-bold text-navy">
        <li>
          <Link href="/app/account/profile" className="underline underline-offset-4">
            Practice details
          </Link>
        </li>
        <li>
          <Link href="/app/account/fees" className="underline underline-offset-4">
            Session fees
          </Link>
        </li>
      </ul>
    </div>
  );
}
