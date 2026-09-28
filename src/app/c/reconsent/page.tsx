import { notFound, redirect } from "next/navigation";
import { requireClient } from "@/server/auth/ctx";
import { NotOwnedError } from "@/server/errors";
import { clientReconsent } from "@/server/services/consents";
import { ReconsentForm } from "@/ui/consent/reconsent-form";
import { problemParam, safeNext } from "../../consent-form";
import { acceptClientReconsent } from "./actions";

export const dynamic = "force-dynamic";

// A client's consent (for one clinician: ?m=<membership>) was signed to an earlier text. Sign-in sends them here.
export default async function ClientReconsentPage({ searchParams }: PageProps<"/c/reconsent">) {
  const self = await requireClient();
  const params = await searchParams;
  const next = safeNext(params.next, "/c");
  const m = typeof params.m === "string" ? params.m : "";
  let view: Awaited<ReturnType<typeof clientReconsent>>;
  try {
    view = await clientReconsent(self, m);
  } catch (e) {
    if (e instanceof NotOwnedError) notFound();
    throw e;
  }
  if (!view.texts.length) redirect(next);
  return <ReconsentForm party="client" texts={view.texts} next={next} membershipId={m} insurer={view.insurer} action={acceptClientReconsent} problem={problemParam(params.problem)} />;
}
