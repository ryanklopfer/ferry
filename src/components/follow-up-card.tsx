"use client";

import { useState } from "react";
import { generateFollowUpDraft, updateFollowUp } from "@/app/actions";
import type { FollowUp, Plan } from "@/server/services/types";
import { FOLLOW_UP_LABELS } from "@/lib/followups";
import { fmtDate } from "./ui";
import { SubmitButton } from "./submit-button";

export function FollowUpCard({ followUp: f, plan, overdue, dueLabel }: { followUp: FollowUp; plan: Plan; overdue: boolean; dueLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`${f.draftSubject ?? ""}\n\n${f.draftBody ?? ""}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const mailto = plan.patientEmail && f.draftBody ? `mailto:?subject=${encodeURIComponent(f.draftSubject ?? "")}&body=${encodeURIComponent(f.draftBody)}` : null;

  return (
    <div className={`card space-y-3 ${overdue ? "border-red-200" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${f.status === "sent" ? "bg-emerald-500" : overdue ? "bg-red-500" : "bg-amber-400"}`} />
        <strong className="text-sm">{FOLLOW_UP_LABELS[f.type]}</strong>
        <span className="text-xs text-stone-500">
          {f.status === "sent" ? `sent ${fmtDate(f.sentAt)}` : `due ${fmtDate(f.dueAt)} · ${dueLabel}`}
        </span>
        {f.status !== "sent" && (
          <form action={updateFollowUp} className="ml-auto">
            <input type="hidden" name="id" value={f.id} />
            <input type="hidden" name="action" value="dismiss" />
            <button className="text-xs text-stone-400 hover:text-stone-700">dismiss</button>
          </form>
        )}
      </div>

      {f.status === "pending" && (
        <form action={generateFollowUpDraft} className="flex items-center gap-3">
          <input type="hidden" name="id" value={f.id} />
          <SubmitButton pending="Drafting…">Generate draft</SubmitButton>
          <span className="text-xs text-stone-500">Writes the letter from this claim&apos;s details. You can edit it before sending.</span>
        </form>
      )}

      {(f.status === "drafted" || f.status === "sent") && (
        <form action={updateFollowUp} className="space-y-2">
          <input type="hidden" name="id" value={f.id} />
          <input className="input font-medium" name="subject" defaultValue={f.draftSubject ?? ""} readOnly={f.status === "sent"} />
          <textarea className="input min-h-64 font-mono text-xs leading-relaxed" name="body" defaultValue={f.draftBody ?? ""} readOnly={f.status === "sent"} />
          {f.status === "drafted" && (
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton name="action" value="sent">Mark as sent</SubmitButton>
              <SubmitButton className="btn-secondary" name="action" value="save">Save edits</SubmitButton>
              <button type="button" className="btn-secondary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
              {mailto && <a className="btn-secondary" href={mailto}>Open in email</a>}
              <span className="ml-auto text-xs text-stone-500">Send via {plan.preferredChannel}{plan.claimsFax ? ` · fax ${plan.claimsFax}` : ""}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
