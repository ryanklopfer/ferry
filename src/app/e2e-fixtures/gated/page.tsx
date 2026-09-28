import { notFound } from "next/navigation";
import { requireClinician } from "@/server/auth/ctx";
import { requireFilingConsent } from "@/server/services/consents";
import { withReconsent } from "../../app/reconsent/gate";
import { E2E_FIXTURES_ON } from "../enabled";

export const dynamic = "force-dynamic";

// Stands in for a filing screen until N10's, for e2e/reconsent.spec.ts: opening it runs the filing gate.
export default async function GatedFixturePage({ searchParams }: PageProps<"/e2e-fixtures/gated">) {
  if (!E2E_FIXTURES_ON()) notFound();
  const ctx = await requireClinician();
  const { client } = await searchParams;
  if (typeof client !== "string") notFound();
  await withReconsent(`/e2e-fixtures/gated?client=${encodeURIComponent(client)}`, () => requireFilingConsent(ctx, client));
  return (
    <div className="mx-auto max-w-xl pt-10">
      <h1 className="font-display text-h1">The gated action ran.</h1>
    </div>
  );
}
