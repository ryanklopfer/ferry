import type { ReactNode } from "react";
import { cx } from "./cx";

// FERRY_BRAND §5: the phone canvas. No fake status bar; the padding sits below the real one.
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto flex w-full max-w-phone flex-col gap-section bg-cream px-gutter pt-screen-top pb-screen-bottom", className)}>{children}</div>;
}
