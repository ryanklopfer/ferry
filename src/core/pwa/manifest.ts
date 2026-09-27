import { BRAND, COLORS } from "@/core/brand";
import { APP_ICONS } from "./icons";

export function appManifest({ id, startUrl }: { id: string; startUrl: string }) {
  return {
    id,
    name: BRAND.name,
    short_name: BRAND.name,
    start_url: startUrl,
    scope: "/",
    display: "standalone" as const,
    background_color: COLORS.cream,
    theme_color: COLORS.cream,
    icons: APP_ICONS.map(({ src, sizes, type, purpose }) => ({ src, sizes, type, purpose })),
  };
}
