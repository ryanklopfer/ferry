import Link from "next/link";
import { listPlans } from "@/lib/service";
import { Empty } from "@/components/ui";
import { requireCtx } from "@/server/auth/ctx";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireCtx();
  const plans = await listPlans();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Insurance plans</h1>
        <Link href="/plans/new" className="btn-primary">Add plan</Link>
      </div>
      {plans.length === 0 ? (
        <Empty>Add the plan you&apos;ll be submitting claims to. You only do this once per plan.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => (
            <li key={p.id} className="card text-sm">
              <div className="font-semibold">{p.insurerName}{p.planName ? ` · ${p.planName}` : ""}</div>
              <div className="text-stone-600">Member {p.memberId}{p.groupNumber ? ` · Group ${p.groupNumber}` : ""}</div>
              <div className="text-stone-600">Patient: {p.patientName} ({p.patientRelationship})</div>
              <div className="mt-2 text-xs text-stone-500">Submit via {p.preferredChannel} · timely filing {p.timelyFilingDays} days</div>
              <Link href={`/claims/new?plan=${p.id}`} className="mt-3 inline-block text-xs underline">New claim on this plan</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
