import Link from "next/link";
import { BRAND } from "@/core/brand";

// FERRY_BRAND §12.5: live text until the logo files arrive (F11). No boat mark is drawn.
const CLASS = "font-display text-h2 tracking-[-0.03em] text-navy";

export function Wordmark({ href }: { href?: string }) {
  return href ? (
    <Link href={href} className={`${CLASS} rounded-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy`}>
      {BRAND.name}
    </Link>
  ) : (
    <span className={CLASS}>{BRAND.name}</span>
  );
}
