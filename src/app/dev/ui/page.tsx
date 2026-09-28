import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { spikeKeyValid } from "@/server/dev-spike";
import { cx } from "@/ui/cx";
import { GALLERY_SCREENS, type GalleryScreen } from "./screens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UI gallery", robots: { index: false }, referrer: "no-referrer" };

function Frame({ screen: { id, title, frame, Body } }: { screen: GalleryScreen }) {
  return (
    <section data-gallery-screen={id} aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-2">
      <h2 id={`${id}-title`} className="text-label text-slate">
        {title}
      </h2>
      <div className={cx("rounded-card bg-mist p-2", frame === "phone" && "mx-auto w-full max-w-phone")}>
        <div className={cx("rounded-card-sm bg-cream", frame === "desktop" && "p-4 md:p-6")}>
          <Body />
        </div>
      </div>
    </section>
  );
}

// Dev tier and this run's key only, like the other /dev pages (src/server/dev-spike.ts). Static: no data, no vendor.
export default async function GalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { k } = await searchParams;
  if (!spikeKeyValid(k)) notFound();
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1">UI gallery</h1>
        <p className="text-secondary text-slate">Dev only. Built from FERRY_BRAND.md; the clinician screens follow its §13 draft.</p>
      </div>
      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        {GALLERY_SCREENS.filter((s) => s.frame === "phone").map((s) => (
          <Frame key={s.id} screen={s} />
        ))}
      </div>
      {GALLERY_SCREENS.filter((s) => s.frame === "desktop").map((s) => (
        <Frame key={s.id} screen={s} />
      ))}
    </div>
  );
}
