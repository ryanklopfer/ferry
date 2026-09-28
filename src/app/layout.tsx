import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { BRAND, COLORS } from "@/core/brand";
import { ServiceWorker } from "@/ui/service-worker";
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

// Chrome lives one level down: src/ui/app-shell.tsx for the app areas (each area's layout.tsx), src/ui/home for
// the public pages, so the homepage carries its own header and no public page links to /account.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
