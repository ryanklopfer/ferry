import Link from "next/link";
import { createClaimFromUpload } from "@/app/actions";
import { listPlans } from "@/server/services/plans";
import { aiEnabled } from "@/lib/ai";
import { SubmitButton } from "@/components/submit-button";
import { requireCtx } from "@/server/auth/ctx";

export const dynamic = "force-dynamic";

export default async function NewClaimPage({ searchParams }: PageProps<"/claims/new">) {
  const ctx = await requireCtx();
  const { plan } = await searchParams;
  const plans = await listPlans(ctx);
  if (plans.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-xl font-semibold">Add an insurance plan first</h1>
        <p className="text-sm text-stone-600">Claims are filed against a plan, so we need your member ID and where to send the claim.</p>
        <Link href="/plans/new" className="btn-primary">Add plan</Link>
      </div>
    );
  }
  return (
    <form action={createClaimFromUpload} className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">New claim</h1>
      <div>
        <label className="label" htmlFor="planId">Insurance plan</label>
        <select className="input" id="planId" name="planId" defaultValue={typeof plan === "string" ? plan : plans[0].id} required>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.insurerName}{p.planName ? ` · ${p.planName}` : ""} — {p.patientName}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="superbill">Superbill (photo or PDF)</label>
        <input className="input file:mr-3 file:rounded file:border-0 file:bg-stone-100 file:px-2 file:py-1 file:text-xs" id="superbill" name="superbill" type="file" accept="image/*,application/pdf" />
        <p className="mt-1 text-xs text-stone-500">
          {aiEnabled()
            ? "Claude reads the provider, NPI, CPT/ICD-10 codes and charges. You review everything before it goes anywhere."
            : "AI extraction is off (set ANTHROPIC_API_KEY). The file is still attached to the claim packet; you'll enter the codes on the next screen."}
        </p>
      </div>
      <SubmitButton pending="Reading superbill…">Continue</SubmitButton>
    </form>
  );
}
