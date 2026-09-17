import { format, formatDistanceToNowStrict } from "date-fns";
import type { ClaimStatus } from "@/db/schema";

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  info_requested: "Info requested",
  denied: "Denied",
  appealed: "Appealed",
  paid: "Paid",
  closed: "Closed",
};

const STATUS_COLOR: Record<ClaimStatus, string> = {
  draft: "bg-stone-100 text-stone-700",
  submitted: "bg-sky-100 text-sky-800",
  acknowledged: "bg-sky-100 text-sky-800",
  info_requested: "bg-amber-100 text-amber-800",
  denied: "bg-red-100 text-red-800",
  appealed: "bg-violet-100 text-violet-800",
  paid: "bg-emerald-100 text-emerald-800",
  closed: "bg-stone-100 text-stone-600",
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>;
}

export const fmtDate = (sec: number | null | undefined) => (sec ? format(new Date(sec * 1000), "MMM d, yyyy") : "—");
export const fmtIso = (s: string | null | undefined) => (s ? format(new Date(s + "T00:00:00"), "MMM d, yyyy") : "—");
export const money = (cents: number | null | undefined) => `$${((cents ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
export const relative = (sec: number) => {
  const diff = sec * 1000 - Date.now();
  const s = formatDistanceToNowStrict(new Date(sec * 1000));
  return diff < 0 ? `${s} overdue` : `in ${s}`;
};

export function Field({ label, name, defaultValue, type = "text", required, placeholder, span }: { label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; placeholder?: string; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">{children}</div>;
}
