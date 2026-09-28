import type { SelectHTMLAttributes } from "react";
import { cx } from "./cx";

// Styled as Input (FERRY_BRAND §6): cream fill, 2px blush border, navy on focus, danger on error.
export function SelectField({
  label,
  name,
  id = name,
  options,
  error,
  hint,
  className,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & { label: string; name: string; options: readonly { value: string; label: string }[]; error?: string; hint?: string }) {
  const help = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label text-slate" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={help ? `${id}-help` : undefined}
        className={cx(
          "min-h-12 w-full min-w-0 rounded-input border-2 border-blush bg-cream px-4 text-body font-semibold text-navy outline-none focus:border-navy aria-invalid:border-danger",
          className,
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && (
        <p id={`${id}-help`} className={cx("text-caption", error ? "text-danger" : "text-slate")}>
          {help}
        </p>
      )}
    </div>
  );
}
