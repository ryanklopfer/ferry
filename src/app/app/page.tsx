import { requireClinician } from "@/server/auth/ctx";

// Placeholder until clinician onboarding (N5) and the client list (N7a).
export default async function ClinicianHome() {
  await requireClinician();
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-10">
      <h1 className="font-display text-h1">Your clients</h1>
      <p className="text-secondary text-slate">Your clients will show up here.</p>
    </div>
  );
}
