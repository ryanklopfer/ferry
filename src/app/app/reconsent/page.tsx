import { redirect } from "next/navigation";
import { requireClinician } from "@/server/auth/ctx";
import { clinicianReconsent } from "@/server/services/consents";
import { ReconsentForm } from "@/ui/consent/reconsent-form";
import { problemParam, safeNext } from "../../consent-form";
import { acceptClinicianReconsent } from "./actions";

export const dynamic = "force-dynamic";

// Shown at sign-in (/home) or by a gated screen when one of the clinician's agreements was signed to an earlier text.
export default async function ClinicianReconsentPage({ searchParams }: PageProps<"/app/reconsent">) {
  const ctx = await requireClinician();
  const params = await searchParams;
  const next = safeNext(params.next, "/app");
  const texts = await clinicianReconsent(ctx);
  if (!texts.length) redirect(next);
  return <ReconsentForm party="clinician" texts={texts} next={next} action={acceptClinicianReconsent} problem={problemParam(params.problem)} />;
}
