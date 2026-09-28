"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./button";

export function SubmitButton({ children, pending, variant = "primary", name, value }: { children: ReactNode; pending?: string; variant?: ButtonVariant; name?: string; value?: string }) {
  const status = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={status.pending} name={name} value={value}>
      {status.pending ? (pending ?? "Working…") : children}
    </Button>
  );
}
