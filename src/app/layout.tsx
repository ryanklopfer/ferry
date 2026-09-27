import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { BRAND, COLORS } from "@/core/brand";
import { InstallPrompt } from "@/ui/install-prompt";
import { ServiceWorker } from "@/ui/service-worker";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: BRAND.name,
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
            <Link href="/" className="font-semibold text-base tracking-tight">{BRAND.name}</Link>
            <Link href="/account" className="ml-auto text-stone-600 hover:text-stone-900">Account</Link>
          </nav>
        </header>
        <InstallPrompt />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <ServiceWorker />
      </body>
    </html>
  );
}
