import { redirect } from "next/navigation";
import { ONBOARDING } from "@/core/copy/onboarding";
import { requireClinician } from "@/server/auth/ctx";
import { profileView } from "@/server/services/clinician";
import { Notice } from "@/ui/notice";
import { PracticeForm } from "@/ui/onboarding/practice-form";
import { profileFormValues } from "../../clinician-forms";
import { updateProfile } from "../actions";

export const dynamic = "force-dynamic";

// The Tax ID shows only as its last four; leaving the field blank keeps it.
export default async function ProfilePage({ searchParams }: PageProps<"/app/account/profile">) {
  const ctx = await requireClinician();
  const profile = await profileView(ctx);
  if (!profile) redirect("/app/welcome");
  const { saved } = await searchParams;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-6">
      <div>
        <h1 className="font-display text-h1">{ONBOARDING.practice.title}</h1>
        <p className="mt-1 text-secondary text-slate">{ONBOARDING.practice.lead}</p>
      </div>
      {saved && (
        <Notice tone="mint" role="status">
          {ONBOARDING.saved}
        </Notice>
      )}
      <PracticeForm action={updateProfile} initial={profileFormValues(profile)} taxIdLast4={profile.taxIdLast4} submit={ONBOARDING.practice.save} />
    </div>
  );
}
