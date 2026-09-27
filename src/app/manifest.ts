import type { MetadataRoute } from "next";
import { BRAND, COLORS } from "@/core/brand";
import { APP_ICONS } from "@/core/pwa/icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND.name,
    short_name: BRAND.name,
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: COLORS.cream,
    theme_color: COLORS.cream,
    icons: APP_ICONS.map(({ src, sizes, type, purpose }) => ({ src, sizes, type, purpose })),
  };
}
