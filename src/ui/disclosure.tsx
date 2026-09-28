"use client";

import { Minus, Plus } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Icon } from "./icon";

// A question that opens to its answer (docs/spec.html "Questions"). A real button, not a styled summary.
export function Disclosure({ question, children, defaultOpen = false }: { question: string; children: ReactNode; defaultOpen?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-card-sm bg-white px-6 py-4">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="flex min-h-touch w-full cursor-pointer items-center justify-between gap-4 text-left text-button leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          <span>{question}</span>
          <Icon icon={open ? Minus : Plus} className="shrink-0" />
        </button>
      </h3>
      <div id={id} hidden={!open} className="pt-2 text-body text-slate">
        {children}
      </div>
    </div>
  );
}
