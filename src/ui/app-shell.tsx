import Link from "next/link";
import type { ReactNode } from "react";
import { InstallPrompt } from "./install-prompt";
import { Wordmark } from "./wordmark";

// The signed-in areas, sign-in and the offline page. Public marketing pages use src/ui/home instead.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-page items-center gap-6 px-gutter py-4">
        <Wordmark href="/" />
        <Link href="/account" className="ml-auto rounded-pill px-2 py-2.5 text-secondary font-bold text-navy focus-visible:outline-2 focus-visible:outline-navy">
          Account
        </Link>
      </header>
      <InstallPrompt />
      <main className="mx-auto w-full max-w-page flex-1 px-gutter py-6">{children}</main>
    </>
  );
}
