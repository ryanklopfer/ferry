import Link from "next/link";
import type { ReactNode } from "react";
import { HOME, trialCta } from "@/core/copy/home";
import { ButtonLink } from "../button";
import { DesktopHeader } from "../desktop-header";
import { Wordmark } from "../wordmark";

const FOCUS = "rounded-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

// Prelaunch hides Log in (there is nothing to sign in to) and turns Start free into the beta email.
export function SiteHeader({ prelaunch }: { prelaunch: boolean }) {
  const start = trialCta(HOME.startFree, prelaunch);
  return (
    <DesktopHeader
      nav={[...HOME.nav]}
      actions={
        <>
          {!prelaunch && (
            <Link href={HOME.logIn.href} className={`text-secondary font-bold text-navy ${FOCUS}`}>
              {HOME.logIn.label}
            </Link>
          )}
          <ButtonLink variant="secondary" fill="blush" href={start.href}>
            {start.label}
          </ButtonLink>
        </>
      }
    />
  );
}

export function SiteFooter() {
  const { tagline, columns, copyright } = HOME.footer;
  return (
    <footer className="mx-auto grid w-full max-w-page gap-8 px-gutter pt-4 pb-12 text-secondary md:grid-cols-[2fr_repeat(3,1fr)] md:px-8">
      <div className="flex flex-col gap-2.5">
        <Wordmark />
        <span className="text-caption text-slate">{tagline}</span>
      </div>
      {columns.map((column) => (
        <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2.5">
          <b>{column.title}</b>
          {column.links.map((link) => (
            <Link key={link.label} href={link.href} className={`self-start font-medium text-slate ${FOCUS}`}>
              {link.label}
            </Link>
          ))}
        </nav>
      ))}
      <span className="text-caption text-slate md:col-span-full">{copyright}</span>
    </footer>
  );
}

// /for-clients, /legal and /start: the wordmark home, the page, and the site footer. No sign-in or sign-up
// link here, so a client choosing their door is never steered into clinician onboarding (start-fork.test.ts).
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-page items-center px-gutter py-5 md:px-8">
        <Wordmark href="/" />
      </header>
      <main className="mx-auto w-full max-w-page flex-1 px-gutter pt-4 pb-16 md:px-8">{children}</main>
      <SiteFooter />
    </>
  );
}
