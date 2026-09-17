"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending, className = "btn-primary", name, value }: { children: React.ReactNode; pending?: string; className?: string; name?: string; value?: string }) {
  const status = useFormStatus();
  return (
    <button className={className} disabled={status.pending} name={name} value={value}>
      {status.pending ? (pending ?? "Working…") : children}
    </button>
  );
}
