export type AppIcon = { src: string; sizes: string; type: "image/png"; purpose: "any" | "maskable"; placeholder: boolean };

// Plain navy tiles until the real app icon arrives (F11). FERRY_BRAND §12.5: never improvise a logo.
// Flip placeholder to false only when the file is the approved artwork; the prod tier refuses to boot until then.
export const APP_ICONS: readonly AppIcon[] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any", placeholder: true },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any", placeholder: true },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable", placeholder: true },
];
