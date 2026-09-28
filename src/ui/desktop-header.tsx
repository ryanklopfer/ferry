import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Wordmark } from "./wordmark";

// docs/spec.html homepage header: wordmark, a white pill of links, then the actions. Below lg the links fold away.
export function DesktopHeader({ nav, current, actions }: { nav: { href: string; label: string }[]; current?: string; actions?: ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-4 px-gutter py-5 md:px-8">
      <Wordmark href="/" />
      <nav aria-label="Site" className="hidden gap-1 rounded-pill bg-white p-1.5 lg:flex">
        {nav.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={href === current ? "page" : undefined}
            className={cx(
              "rounded-pill px-4 py-2.5 text-nav focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
              href === current ? "bg-blush text-navy" : "text-slate",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {actions && <div className="flex flex-wrap items-center gap-4">{actions}</div>}
    </header>
  );
}
