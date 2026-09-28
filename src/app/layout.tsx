import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { BRAND, COLORS } from "@/core/brand";
import { InstallPrompt } from "@/ui/install-prompt";
import { ServiceWorker } from "@/ui/service-worker";
import { Wordmark } from "@/ui/wordmark";
import "./globals.css";

// FERRY_BRAND §4, self-hosted by next/font; globals.css puts each first in its stack.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const body = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: BRAND.name,
  applicationName: BRAND.name,
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: COLORS.cream };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-page items-center gap-6 px-gutter py-4">
          <Wordmark href="/" />
          <Link href="/account" className="ml-auto rounded-pill px-2 py-2.5 text-secondary font-bold text-navy focus-visible:outline-2 focus-visible:outline-navy">
            Account
          </Link>
        </header>
        <InstallPrompt />
        <main className="mx-auto w-full max-w-page flex-1 px-gutter py-6">{children}</main>
        <ServiceWorker />
      </body>
    </html>
  );
}
