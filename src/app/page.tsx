import Link from "next/link";
import { listClaims } from "@/server/services/claims";
import { FOLLOW_UP_LABELS } from "@/lib/followups";
import { Empty, StatusBadge, fmtIso, money, relative } from "@/components/ui";
import { requireClinician } from "@/server/auth/ctx";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const ctx = await requireClinician();
  const { rows, followUps } = await listClaims(ctx);
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 86_400_000);
  const byClaim = new Map(rows.map((r) => [r.claim.id, r]));
  const due = followUps.filter((f) => f.dueAt <= weekOut && byClaim.has(f.claimId));
  const outstanding = rows.filter((r) => !["paid", "closed", "draft"].includes(r.claim.status)).reduce((s, r) => s + r.claim.totalCharged, 0);
  const recovered = rows.reduce((s, r) => s + (r.claim.amountReimbursed ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Claims" value={String(rows.length)} />
        <Stat label="Outstanding with insurers" value={money(outstanding)} />
        <Stat label="Reimbursed to date" value={money(recovered)} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Action items</h2>
        {due.length === 0 ? (
          <Empty>Nothing due this week. Follow-ups are scheduled automatically when a claim changes status.</Empty>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {due.map((f) => {
              const r = byClaim.get(f.claimId)!;
              const overdue = f.dueAt <= now;
              return (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${overdue ? "bg-red-500" : "bg-amber-400"}`} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/claims/${f.claimId}#followups`} className="font-medium hover:underline">{FOLLOW_UP_LABELS[f.type]}</Link>
                    <div className="truncate text-stone-500">{r.plan.insurerName} · {r.claim.billingProviderName ?? "Unknown provider"} · {fmtIso(r.claim.serviceDateStart)}</div>
                  </div>
                  <span className={`text-xs ${overdue ? "text-red-600" : "text-stone-500"}`}>{relative(f.dueAt)}</span>
                  {f.status === "drafted" && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">draft ready</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Claims</h2>
          <Link href="/claims/new" className="text-sm text-stone-700 underline">New claim</Link>
        </div>
        {rows.length === 0 ? (
          <Empty>
            No claims yet. <Link href="/plans/new" className="underline">Add your insurance plan</Link>, then upload a superbill.
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2">Service date</th>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">Insurer</th>
                  <th className="px-4 py-2 text-right">Charged</th>
                  <th className="px-4 py-2 text-right">Reimbursed</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map(({ claim, plan }) => (
                  <tr key={claim.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2"><Link href={`/claims/${claim.id}`} className="font-medium hover:underline">{fmtIso(claim.serviceDateStart)}</Link></td>
                    <td className="px-4 py-2">{claim.billingProviderName ?? "—"}</td>
                    <td className="px-4 py-2">{plan.insurerName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(claim.totalCharged)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{claim.amountReimbursed != null ? money(claim.amountReimbursed) : "—"}</td>
                    <td className="px-4 py-2"><StatusBadge status={claim.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
