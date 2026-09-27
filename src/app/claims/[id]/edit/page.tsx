import { notFound } from "next/navigation";
import Link from "next/link";
import { saveClaim } from "@/app/actions";
import { getClaim } from "@/server/services/claims";
import { fromCents } from "@/lib/extraction";
import { Field } from "@/components/ui";
import { LineItemsEditor } from "@/components/line-items-editor";
import { SuperbillPreview } from "@/components/superbill-preview";
import { requireClinician } from "@/server/auth/ctx";

export const dynamic = "force-dynamic";

export default async function EditClaimPage({ params }: PageProps<"/claims/[id]/edit">) {
  const ctx = await requireClinician();
  const { id } = await params;
  const view = await getClaim(ctx, id);
  if (!view) notFound();
  const { claim, plan, lines, superbill } = view;

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
          <h2 className="font-medium">Billing provider</h2>
          <p className="text-xs text-stone-500">The practice or clinician whose name and Tax ID are on the superbill.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider / practice name" name="billingProviderName" defaultValue={claim.billingProviderName} required />
            <Field label="NPI (10 digits)" name="billingProviderNpi" defaultValue={claim.billingProviderNpi} placeholder="1234567890" />
            <Field label="Tax ID" name="billingProviderTaxId" defaultValue={claim.billingProviderTaxId} placeholder="12-3456789" />
            <div>
              <label className="label" htmlFor="billingProviderTaxIdType">Tax ID is</label>
              <select className="input" id="billingProviderTaxIdType" name="billingProviderTaxIdType" defaultValue={claim.billingProviderTaxIdType ?? ""}>
                <option value="">Not sure</option>
                <option value="EIN">An EIN (12-3456789)</option>
                <option value="SSN">A Social Security number</option>
              </select>
            </div>
            <Field label="Phone" name="billingProviderPhone" defaultValue={claim.billingProviderPhone} />
            <Field label="Place of service code" name="placeOfService" defaultValue={claim.placeOfService ?? "11"} placeholder="11 = office, 10 = telehealth (home)" />
            <Field label="Address" name="billingProviderAddress" defaultValue={claim.billingProviderAddress} span />
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-medium">Rendering provider</h2>
          <p className="text-xs text-stone-500">Only if the clinician who saw you is different from the billing provider above, as in a group practice. Leave blank otherwise.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Clinician name" name="renderingProviderName" defaultValue={claim.renderingProviderName} />
            <Field label="Clinician NPI (10 digits)" name="renderingProviderNpi" defaultValue={claim.renderingProviderNpi} />
            <Field label="Credential" name="renderingProviderCredential" defaultValue={claim.renderingProviderCredential} placeholder="LCSW, PhD, MD…" />
            <Field label="License" name="renderingProviderLicense" defaultValue={claim.renderingProviderLicense} />
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-medium">Diagnosis and services</h2>
          <Field label="ICD-10 diagnosis codes (comma separated)" name="diagnosisCodes" defaultValue={claim.diagnosisCodes.join(", ")} placeholder="M54.50, M25.551" />
          <LineItemsEditor
            initial={lines.map((li) => ({ serviceDate: li.serviceDate ?? "", cptCode: li.cptCode, modifiers: li.modifiers.join(" "), description: li.description ?? "", pointers: li.diagnosisPointers.join(","), pos: li.placeOfService && li.placeOfService !== claim.placeOfService ? li.placeOfService : "", units: li.units, charge: fromCents(li.charge) }))}
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
        <SuperbillPreview claimId={claim.id} mime={superbill?.mime ?? null} />
      </aside>
    </div>
  );
}
