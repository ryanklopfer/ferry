import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { BRAND, COLORS } from "@/core/brand";
import { InstallPrompt } from "@/ui/install-prompt";
import { ServiceWorker } from "@/ui/service-worker";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Superbill Claims",
  description: "Submit out-of-network superbills to your insurer and chase reimbursement automatically.",
  applicationName: BRAND.name,
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: COLORS.cream };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold text-base tracking-tight">Superbill Claims</Link>
            <Link href="/" className="text-stone-600 hover:text-stone-900">Dashboard</Link>
            <Link href="/plans" className="text-stone-600 hover:text-stone-900">Insurance plans</Link>
            <Link href="/account" className="text-stone-600 hover:text-stone-900">Account</Link>
            <Link href="/claims/new" className="ml-auto rounded-md bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700">New claim</Link>
          </nav>
        </header>
        <InstallPrompt />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-6 text-xs text-stone-500">
          Data stays on this machine (local Postgres and ./data/uploads). Letters are templates, not legal advice; confirm deadlines with your plan documents.
        </footer>
        <ServiceWorker />
      </body>
    </html>
  );
}
