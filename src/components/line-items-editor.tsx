"use client";

import { useState } from "react";

export type LineItemDraft = { serviceDate: string; cptCode: string; modifier: string; description: string; units: number; charge: string };

export function LineItemsEditor({ initial }: { initial: LineItemDraft[] }) {
  const [rows, setRows] = useState<LineItemDraft[]>(initial.length ? initial : [blank()]);
  const total = rows.reduce((s, r) => s + (Number(r.charge) || 0), 0);
  const update = (i: number, patch: Partial<LineItemDraft>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[110px_80px_60px_1fr_50px_90px_28px] gap-2 text-xs font-medium text-stone-500 sm:grid">
        <span>Date</span><span>CPT</span><span>Mod</span><span>Description</span><span>Units</span><span>Charge $</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-md border border-stone-200 p-2 sm:grid-cols-[110px_80px_60px_1fr_50px_90px_28px] sm:border-0 sm:p-0">
          <input className="input" type="date" name="li_date" value={r.serviceDate} onChange={(e) => update(i, { serviceDate: e.target.value })} />
          <input className="input font-mono" name="li_cpt" value={r.cptCode} placeholder="97110" maxLength={5} onChange={(e) => update(i, { cptCode: e.target.value.toUpperCase() })} />
          <input className="input font-mono" name="li_mod" value={r.modifier} placeholder="GP" maxLength={2} onChange={(e) => update(i, { modifier: e.target.value.toUpperCase() })} />
          <input className="input" name="li_desc" value={r.description} placeholder="Therapeutic exercise" onChange={(e) => update(i, { description: e.target.value })} />
          <input className="input" type="number" min={1} name="li_units" value={r.units} onChange={(e) => update(i, { units: Number(e.target.value) })} />
          <input className="input tabular-nums" type="number" step="0.01" min={0} name="li_charge" value={r.charge} onChange={(e) => update(i, { charge: e.target.value })} />
          <button type="button" aria-label="Remove line" className="text-stone-400 hover:text-red-600" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button type="button" className="btn-secondary" onClick={() => setRows((rs) => [...rs, { ...blank(), serviceDate: rs[rs.length - 1]?.serviceDate ?? "" }])}>Add line</button>
        <span className="text-sm">Total <strong className="tabular-nums">${total.toFixed(2)}</strong></span>
      </div>
    </div>
  );
}

const blank = (): LineItemDraft => ({ serviceDate: "", cptCode: "", modifier: "", description: "", units: 1, charge: "" });
