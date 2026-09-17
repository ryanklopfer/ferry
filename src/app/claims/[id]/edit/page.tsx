import { notFound } from "next/navigation";
import Link from "next/link";
import { saveClaim } from "@/app/actions";
import { getClaimContext } from "@/lib/service";
import { fromCents } from "@/lib/extraction";
import { Field } from "@/components/ui";
import { LineItemsEditor } from "@/components/line-items-editor";
import { SuperbillPreview } from "@/components/superbill-preview";

export const dynamic = "force-dynamic";

export default async function EditClaimPage({ params }: PageProps<"/claims/[id]/edit">) {
  const { id } = await params;
  const ctx = await getClaimContext(Number(id));
  if (!ctx) notFound();
  const { claim, plan, lineItems } = ctx;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <form action={saveClaim} className="space-y-6">
        <input type="hidden" name="id" value={claim.id} />
        <div>
          <h1 className="text-xl font-semibold">Review claim details</h1>
          <p className="text-sm text-stone-600">{plan.insurerName} · {plan.patientName}. Check every field against the superbill — insurers deny for a single wrong digit.</p>
        </div>

        {claim.extractionNotes && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Check:</strong> {claim.extractionNotes}
          </div>
        )}

        <section className="card space-y-3">
          <h2 className="font-medium">Provider</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider / practice name" name="providerName" defaultValue={claim.providerName} required />
            <Field label="NPI (10 digits)" name="providerNpi" defaultValue={claim.providerNpi} placeholder="1234567890" />
            <Field label="Tax ID / EIN" name="providerTaxId" defaultValue={claim.providerTaxId} placeholder="12-3456789" />
            <Field label="Phone" name="providerPhone" defaultValue={claim.providerPhone} />
            <Field label="Address" name="providerAddress" defaultValue={claim.providerAddress} span />
            <Field label="Place of service code" name="placeOfService" defaultValue={claim.placeOfService ?? "11"} placeholder="11 = office, 10 = telehealth (home)" />
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-medium">Diagnosis and services</h2>
          <Field label="ICD-10 diagnosis codes (comma separated)" name="diagnosisCodes" defaultValue={claim.diagnosisCodes.join(", ")} placeholder="M54.50, M25.551" />
          <LineItemsEditor
            initial={lineItems.map((li) => ({ serviceDate: li.serviceDate ?? "", cptCode: li.cptCode, modifier: li.modifier ?? "", description: li.description ?? "", units: li.units, charge: fromCents(li.charge) }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount you paid (blank = total charged)" name="totalPaid" type="number" defaultValue={claim.totalPaid ? fromCents(claim.totalPaid) : ""} />
          </div>
        </section>

        <div className="flex gap-2">
          <button className="btn-primary">Save claim</button>
          <Link href={`/claims/${claim.id}`} className="btn-secondary">Cancel</Link>
        </div>
      </form>

      <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <h2 className="text-sm font-medium text-stone-600">Superbill</h2>
        <SuperbillPreview claimId={claim.id} mime={claim.superbillMime} />
      </aside>
    </div>
  );
}
