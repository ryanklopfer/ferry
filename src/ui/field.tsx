import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

// FERRY_BRAND §6: cream fill, 2px blush border, navy on focus, danger on error.
export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx(
        "min-h-12 w-full min-w-0 rounded-input border-2 border-blush bg-cream px-4 text-body font-semibold text-navy outline-none focus:border-navy aria-invalid:border-danger",
        className,
      )}
      {...rest}
    />
  );
}

export function Field({ label, name, id = name, error, hint, ...rest }: Omit<InputProps, "invalid"> & { label: string; name: string; error?: string; hint?: string }) {
  const help = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label text-slate" htmlFor={id}>
        {label}
      </label>
      <Input id={id} name={name} invalid={Boolean(error)} aria-describedby={help ? `${id}-help` : undefined} {...rest} />
      {help && (
        <p id={`${id}-help`} className={cx("text-caption", error ? "text-danger" : "text-slate")}>
          {help}
        </p>
      )}
    </div>
  );
}
