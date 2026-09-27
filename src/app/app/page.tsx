import { requireClinician } from "@/server/auth/ctx";

// Placeholder until clinician onboarding (N5) and the client list (N7a).
export default async function ClinicianHome() {
  await requireClinician();
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-10">
      <h1 className="text-xl font-semibold">Your clients</h1>
      <p className="text-sm text-stone-600">Your clients will show up here.</p>
    </div>
  );
}
