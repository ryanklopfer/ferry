import Link from "next/link";
import { notFound } from "next/navigation";
import { closeClaim, deleteClaim, markAppealed, markSubmitted, recordOutcome } from "@/app/actions";
import { getClaim } from "@/server/services/claims";
import { aiEnabled } from "@/lib/ai";
import { StatusBadge, fmtDate, fmtIso, money, relative } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FollowUpCard } from "@/components/follow-up-card";
import { SuperbillPreview } from "@/components/superbill-preview";
import { requireCtx } from "@/server/auth/ctx";

export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

export default async function ClaimPage({ params }: PageProps<"/claims/[id]">) {
  const ctx = await requireCtx();
  const { id } = await params;
  const view = await getClaim(ctx, id);
  if (!view) notFound();
  const { claim, plan, lines, followUps, events, superbill, deadlines } = view;
  const now = new Date();
  const filingDeadline = deadlines.timelyFiling;
  const appealBy = deadlines.appeal;
  const open = followUps.filter((f) => f.status === "pending" || f.status === "drafted");
  const done = followUps.filter((f) => f.status === "sent");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{claim.billingProviderName ?? "Untitled claim"}</h1>
              <StatusBadge status={claim.status} />
            </div>
            <p className="text-sm text-stone-600">{plan.insurerName} · Member {plan.memberId} · {fmtIso(claim.serviceDateStart)}{claim.serviceDateEnd && claim.serviceDateEnd !== claim.serviceDateStart ? ` – ${fmtIso(claim.serviceDateEnd)}` : ""}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/claims/${claim.id}/edit`} className="btn-secondary">Edit details</Link>
            <a href={`/api/claims/${claim.id}/packet`} target="_blank" className="btn-primary">Claim packet (PDF)</a>
          </div>
        </div>

        {claim.status === "draft" && filingDeadline && (
          <Notice tone={filingDeadline.getTime() - now.getTime() < 30 * 86_400_000 ? "warn" : "info"}>
            Timely filing deadline ≈ <strong>{fmtDate(filingDeadline)}</strong> ({plan.timelyFilingDays} days from service). Download the packet, submit it via {plan.preferredChannel}
            {plan.portalUrl ? <> (<a className="underline" href={plan.portalUrl} target="_blank">portal</a>)</> : plan.claimsFax ? ` (fax ${plan.claimsFax})` : plan.claimsAddress ? ` (${plan.claimsAddress})` : ""}, then record it below.
          </Notice>
        )}
        {claim.status === "denied" && appealBy && (
          <Notice tone="warn">Denied {fmtDate(claim.decisionAt)}: “{claim.denialReason}”. Appeal deadline ≈ <strong>{fmtDate(appealBy)}</strong>.</Notice>
        )}
        {claim.status === "info_requested" && <Notice tone="warn">Insurer asked for: “{claim.infoRequested}”. Respond quickly — pended claims can be closed if you don&apos;t.</Notice>}
        {claim.status === "paid" && <Notice tone="ok">Reimbursed {money(claim.amountReimbursed)} of {money(claim.totalCharged)} charged.</Notice>}

        <section className="card">
          <h2 className="mb-2 font-medium">Services</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-stone-500">
              <tr><th className="py-1">Date</th><th>CPT</th><th>Description</th><th>Dx</th><th>POS</th><th className="text-right">Units</th><th className="text-right">Charge</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lines.map((li) => (
                <tr key={li.id}>
                  <td className="py-1">{fmtIso(li.serviceDate)}</td>
                  <td className="font-mono">{[li.cptCode, ...li.modifiers].join("-")}</td>
                  <td>{li.description}</td>
                  <td className="font-mono">{li.diagnosisPointers.map((p) => String.fromCharCode(64 + p)).join(",")}</td>
                  <td className="font-mono">{li.placeOfService ?? "—"}</td>
                  <td className="text-right tabular-nums">{li.units}</td>
                  <td className="text-right tabular-nums">{money(li.charge)}</td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={7} className="py-3 text-center text-stone-500">No line items — <Link className="underline" href={`/claims/${claim.id}/edit`}>add them</Link>.</td></tr>}
            </tbody>
            <tfoot className="text-sm font-medium"><tr><td colSpan={6} className="pt-2 text-right">Total</td><td className="pt-2 text-right tabular-nums">{money(claim.totalCharged)}</td></tr></tfoot>
          </table>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600 sm:grid-cols-4">
            <dt>Billing NPI</dt><dd className="font-mono text-stone-900">{claim.billingProviderNpi ?? "—"}</dd>
            <dt>Tax ID</dt><dd className="font-mono text-stone-900">{claim.billingProviderTaxId ?? "—"}</dd>
            <dt>Rendering</dt><dd className="text-stone-900">{claim.renderingProviderName ? `${claim.renderingProviderName}${claim.renderingProviderCredential ? `, ${claim.renderingProviderCredential}` : ""}` : "Same as billing"}</dd>
            <dt>Rendering NPI</dt><dd className="font-mono text-stone-900">{claim.renderingProviderNpi ?? "—"}</dd>
            <dt>ICD-10</dt><dd className="font-mono text-stone-900">{claim.diagnosisCodes.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join("  ") || "—"}</dd>
            <dt>POS</dt><dd className="font-mono text-stone-900">{claim.placeOfService ?? "—"}</dd>
          </dl>
        </section>

        <section className="card space-y-3">
          <h2 className="font-medium">Update status</h2>
          {claim.status === "draft" && (
            <form action={markSubmitted} className="grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={claim.id} />
              <div><label className="label">Submitted on</label><input className="input" type="date" name="submittedAt" defaultValue={today()} required /></div>
              <div>
                <label className="label">Via</label>
                <select className="input" name="channel" defaultValue={plan.preferredChannel}>
                  <option value="portal">Portal</option><option value="fax">Fax</option><option value="mail">Mail</option><option value="email">Email</option>
                </select>
              </div>
              <div><label className="label">Confirmation #</label><input className="input" name="confirmationNumber" placeholder="optional" /></div>
              <div className="flex items-end"><SubmitButton>Mark submitted</SubmitButton></div>
            </form>
          )}
          {["submitted", "acknowledged", "appealed", "info_requested"].includes(claim.status) && (
            <form action={recordOutcome} className="grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={claim.id} />
              <div>
                <label className="label">Insurer response</label>
                <select className="input" name="outcome" defaultValue={claim.status === "submitted" ? "acknowledged" : "paid"}>
                  {claim.status === "submitted" && <option value="acknowledged">Acknowledged / claim # assigned</option>}
                  <option value="paid">Paid (EOB received)</option>
                  <option value="denied">Denied</option>
                  <option value="info_requested">More information requested</option>
                </select>
              </div>
              <div><label className="label">Date</label><input className="input" type="date" name="decisionAt" defaultValue={today()} required /></div>
              <div><label className="label">Amount paid (if paid)</label><input className="input" name="amountReimbursed" placeholder="142.50" /></div>
              <div><label className="label">Claim #</label><input className="input" name="confirmationNumber" defaultValue={claim.confirmationNumber ?? ""} /></div>
              <div className="sm:col-span-3"><label className="label">Denial reason / info requested / notes (paste from EOB)</label><input className="input" name="reason" /></div>
              <div className="flex items-end"><SubmitButton>Record</SubmitButton></div>
            </form>
          )}
          {claim.status === "denied" && (
            <form action={markAppealed} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={claim.id} />
              <div><label className="label">Appeal sent on</label><input className="input" type="date" name="appealedAt" defaultValue={today()} required /></div>
              <SubmitButton>Mark appealed</SubmitButton>
              <span className="text-xs text-stone-500">Generate the appeal letter from the follow-up list first.</span>
            </form>
          )}
          {claim.status !== "closed" && (
            <form action={closeClaim} className="flex items-center gap-3 border-t border-stone-100 pt-3">
              <input type="hidden" name="id" value={claim.id} />
              <input className="input max-w-xs" name="note" placeholder="Reason for closing (optional)" />
              <SubmitButton className="btn-secondary">Close claim</SubmitButton>
            </form>
          )}
        </section>

        <section id="followups" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Follow-ups</h2>
            <span className="text-xs text-stone-500">{aiEnabled() ? "Drafted by Claude from this claim's facts" : "Template drafts (set ANTHROPIC_API_KEY for tailored letters)"}</span>
          </div>
          {open.length === 0 && <div className="rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-500">Nothing scheduled for this status.</div>}
          {open.map((f) => <FollowUpCard key={f.id} followUp={f} plan={plan} overdue={f.dueAt <= now} dueLabel={relative(f.dueAt)} />)}
          {done.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-stone-600">{done.length} sent</summary>
              <div className="mt-2 space-y-2">{done.map((f) => <FollowUpCard key={f.id} followUp={f} plan={plan} overdue={f.dueAt <= now} dueLabel={relative(f.dueAt)} />)}</div>
            </details>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <SuperbillPreview claimId={claim.id} mime={superbill?.mime ?? null} />
        <section className="card text-sm">
          <h2 className="mb-2 font-medium">Where to send it</h2>
          <dl className="space-y-1 text-xs">
            {plan.portalUrl && <Row k="Portal"><a className="underline" href={plan.portalUrl} target="_blank">{plan.portalUrl}</a></Row>}
            {plan.claimsFax && <Row k="Fax">{plan.claimsFax}</Row>}
            {plan.claimsPhone && <Row k="Phone">{plan.claimsPhone}</Row>}
            {plan.claimsAddress && <Row k="Mail">{plan.claimsAddress}</Row>}
            {!plan.portalUrl && !plan.claimsFax && !plan.claimsAddress && <p className="text-stone-500">No submission details on this plan yet.</p>}
          </dl>
        </section>
        <section className="card text-sm">
          <h2 className="mb-2 font-medium">Timeline</h2>
          <ol className="space-y-2 text-xs">
            {events.map((e) => (
              <li key={e.id}>
                <div className="text-stone-500">{fmtDate(e.createdAt)}</div>
                <div><span className="font-medium">{e.type.replace(":", " · ")}</span>{e.note ? ` — ${e.note}` : ""}</div>
              </li>
            ))}
          </ol>
        </section>
        <form action={deleteClaim}>
          <input type="hidden" name="id" value={claim.id} />
          <button className="text-xs text-stone-400 hover:text-red-600">Delete this claim</button>
        </form>
      </aside>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[50px_1fr] gap-2"><dt className="text-stone-500">{k}</dt><dd className="break-words">{children}</dd></div>;
}

function Notice({ tone, children }: { tone: "info" | "warn" | "ok"; children: React.ReactNode }) {
  const cls = { info: "border-sky-200 bg-sky-50 text-sky-900", warn: "border-amber-200 bg-amber-50 text-amber-900", ok: "border-emerald-200 bg-emerald-50 text-emerald-900" }[tone];
  return <div className={`rounded-md border p-3 text-sm ${cls}`}>{children}</div>;
}
