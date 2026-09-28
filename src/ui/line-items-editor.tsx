"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "./button";
import { Input } from "./field";

export type LineItemDraft = { serviceDate: string; cptCode: string; modifiers: string; description: string; pointers: string; pos: string; units: number; charge: string };

const GRID = "sm:grid-cols-[110px_80px_96px_1fr_56px_48px_50px_90px_44px]";

export function LineItemsEditor({ initial }: { initial: LineItemDraft[] }) {
  const [rows, setRows] = useState<LineItemDraft[]>(initial.length ? initial : [blank()]);
  const total = rows.reduce((s, r) => s + (Number(r.charge) || 0), 0);
  const update = (i: number, patch: Partial<LineItemDraft>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-2">
      <div className={`hidden gap-2 text-label text-slate sm:grid ${GRID}`}>
        <span>Date</span><span>CPT</span><span>Modifiers</span><span>Description</span><span>Dx</span><span>POS</span><span>Units</span><span>Charge $</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className={`grid grid-cols-2 gap-2 rounded-card-sm bg-white p-2 sm:bg-transparent sm:p-0 ${GRID}`}>
          <Input type="date" name="li_date" value={r.serviceDate} onChange={(e) => update(i, { serviceDate: e.target.value })} />
          <Input className="tabular-nums" name="li_cpt" value={r.cptCode} placeholder="90834" maxLength={5} onChange={(e) => update(i, { cptCode: e.target.value.toUpperCase() })} />
          <Input className="tabular-nums" name="li_mod" value={r.modifiers} placeholder="95 HO" maxLength={11} aria-label="Modifiers, up to four, separated by spaces" onChange={(e) => update(i, { modifiers: e.target.value.toUpperCase() })} />
          <Input name="li_desc" value={r.description} placeholder="Psychotherapy, 45 minutes" onChange={(e) => update(i, { description: e.target.value })} />
          <Input className="tabular-nums" name="li_dx" value={r.pointers} placeholder="1,2" aria-label="Which diagnoses this service is for, by position" onChange={(e) => update(i, { pointers: e.target.value })} />
          <Input className="tabular-nums" name="li_pos" value={r.pos} placeholder="11" maxLength={2} aria-label="Place of service for this line, if different from the claim" onChange={(e) => update(i, { pos: e.target.value })} />
          <Input type="number" min={1} name="li_units" value={r.units} onChange={(e) => update(i, { units: Number(e.target.value) })} />
          <Input className="tabular-nums" type="number" step="0.01" min={0} name="li_charge" value={r.charge} onChange={(e) => update(i, { charge: e.target.value })} />
          <IconButton icon={X} label="Remove line" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Button variant="secondary" onClick={() => setRows((rs) => [...rs, { ...blank(), serviceDate: rs[rs.length - 1]?.serviceDate ?? "" }])}>Add line</Button>
        <span className="text-secondary">Total <strong className="tabular-nums">${total.toFixed(2)}</strong></span>
      </div>
    </div>
  );
}

const blank = (): LineItemDraft => ({ serviceDate: "", cptCode: "", modifiers: "", description: "", pointers: "1", pos: "", units: 1, charge: "" });
