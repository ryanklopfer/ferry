import type { MetadataRoute } from "next";
import { BRAND, COLORS } from "@/core/brand";
import { APP_ICONS } from "@/core/pwa/icons";
import { manifestStartUrl } from "@/server/dev-spike";

// Per request: with FERRY_SPIKE_K in the dev tier the installed app opens on the mic spike, and a key in a
// build environment must never end up in a prebuilt manifest.
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND.name,
    short_name: BRAND.name,
    start_url: manifestStartUrl(),
    scope: "/",
    display: "standalone",
    background_color: COLORS.cream,
    theme_color: COLORS.cream,
    icons: APP_ICONS.map(({ src, sizes, type, purpose }) => ({ src, sizes, type, purpose })),
  };
}
