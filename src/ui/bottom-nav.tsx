import { FileText, House, type LucideIcon, NotebookPen, ShieldCheck, Ship, Users } from "lucide-react";
import Link from "next/link";
import { cx } from "./cx";
import { Icon } from "./icon";

// Client items are FERRY_BRAND §6. Clinician items follow the §13 draft until Ryan approves it.
export const NAV_ITEMS: Record<"client" | "clinician", { href: string; label: string; icon: LucideIcon }[]> = {
  client: [
    { href: "/c", label: "Home", icon: House },
    { href: "/c/trips", label: "Trips", icon: Ship },
    { href: "/c/insurers", label: "Insurers", icon: ShieldCheck },
  ],
  clinician: [
    { href: "/app", label: "Today", icon: NotebookPen },
    { href: "/app/clients", label: "Clients", icon: Users },
    { href: "/app/letters", label: "Letters", icon: FileText },
  ],
};

// Icon beside label as §6 draws it; on a nav narrower than 20rem (small phones, large text) the label drops below.
export function BottomNav({ variant, current, label = "Main" }: { variant: keyof typeof NAV_ITEMS; current: string; label?: string }) {
  return (
    <nav aria-label={label} className="@container flex min-h-nav items-center gap-1 rounded-pill bg-white p-2">
      {NAV_ITEMS[variant].map(({ href, label, icon }) => {
        const active = href === current;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex min-h-nav-item min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-pill px-2 text-nav @xs:flex-row @xs:gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
              active ? "bg-blush text-navy" : "text-slate",
            )}
          >
            <Icon icon={icon} size={20} className="shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
