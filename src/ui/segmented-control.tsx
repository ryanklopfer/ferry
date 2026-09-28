"use client";

import { type ReactNode, useState } from "react";
import { cx } from "./cx";

// docs/spec.html "Ways to capture": a white pill of pressed/unpressed buttons; the pressed one is blush.
// Icons arrive rendered (<Icon icon={Mic} size={18} />): a server page can pass an element, not a component.
export function SegmentedControl<T extends string>({
  label,
  options,
  defaultValue,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: ReactNode }[];
  defaultValue: T;
  onChange?: (value: T) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div role="group" aria-label={label} className="flex max-w-full flex-wrap gap-1 self-start rounded-card-sm bg-white p-1.5 sm:rounded-pill">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => {
            setValue(o.value);
            onChange?.(o.value);
          }}
          className={cx(
            "inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-pill px-4 text-secondary font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
            o.value === value ? "bg-blush text-navy" : "text-slate",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
