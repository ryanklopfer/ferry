import type { LucideIcon } from "lucide-react";

// FERRY_BRAND §7: outline only, 2.2 stroke, currentColor; 22 in buttons and headers, 20 in nav, 16 in chips.
export function Icon({ icon: Glyph, size = 22, className }: { icon: LucideIcon; size?: 16 | 18 | 20 | 22 | 32; className?: string }) {
  return <Glyph size={size} strokeWidth={2.2} aria-hidden="true" focusable="false" className={className} />;
}
