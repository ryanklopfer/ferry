import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "tertiary";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill text-center text-navy cursor-pointer transition-transform duration-120 active:scale-97 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:bg-mist disabled:text-slate disabled:active:scale-100";

// FERRY_BRAND §6. Peach is the one primary action per screen (banned-classes.test.ts counts data-variant).
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "min-h-btn-primary px-7 bg-peach text-button",
  secondary: "min-h-btn-secondary px-6 text-secondary font-bold",
  tertiary: "min-h-btn-tertiary px-3.5 bg-transparent text-secondary font-bold",
};

export function buttonClass(variant: ButtonVariant, fill: "white" | "blush" = "white", className?: string) {
  return cx(BASE, VARIANTS[variant], variant === "secondary" && (fill === "blush" ? "bg-blush" : "bg-white"), className);
}

type Common = { variant: ButtonVariant; fill?: "white" | "blush"; icon?: LucideIcon; children: ReactNode };

export function Button({ variant, fill, icon, children, className, type = "button", ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} data-variant={variant} className={buttonClass(variant, fill, className)} {...rest}>
      {icon && <Icon icon={icon} />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, fill, icon, children, className, ...rest }: Common & Omit<ComponentProps<typeof Link>, "children">) {
  return (
    <Link data-variant={variant} className={buttonClass(variant, fill, className)} {...rest}>
      {icon && <Icon icon={icon} />}
      {children}
    </Link>
  );
}

// Icon-only, so the label is required and becomes the accessible name (§10).
export function IconButton({ icon, label, className, type = "button", ...rest }: { icon: LucideIcon; label: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label">) {
  return (
    <button type={type} aria-label={label} data-variant="tertiary" className={cx(BASE, "size-touch shrink-0 bg-transparent", className)} {...rest}>
      <Icon icon={icon} />
    </button>
  );
}
