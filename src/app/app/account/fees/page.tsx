import { ONBOARDING } from "@/core/copy/onboarding";
import { centsToDollars } from "@/core/fee-schedule";
import { requireClinician } from "@/server/auth/ctx";
import { feesView } from "@/server/services/clinician";
import { Notice } from "@/ui/notice";
import { FeesForm } from "@/ui/onboarding/fees-form";
import { updateFees } from "../actions";

export const dynamic = "force-dynamic";

export default async function FeesPage({ searchParams }: PageProps<"/app/account/fees">) {
  const ctx = await requireClinician();
  const fees = await feesView(ctx);
  const { saved } = await searchParams;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-6">
      <div>
        <h1 className="font-display text-h1">{ONBOARDING.fees.title}</h1>
        <p className="mt-1 text-secondary text-slate">{ONBOARDING.fees.lead}</p>
      </div>
      {saved && (
        <Notice tone="mint" role="status">
          {ONBOARDING.saved}
        </Notice>
      )}
      <FeesForm action={updateFees} initial={Object.fromEntries(fees.map((f) => [f.cptCode, centsToDollars(f.chargeCents)]))} submit={ONBOARDING.fees.save} />
    </div>
  );
}
