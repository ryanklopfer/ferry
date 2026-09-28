import type { ReactNode } from "react";
import { cx } from "./cx";

// A one-line callout inside a screen: blush for "one thing to know", mint for good news (docs/spec.html .notice).
export function Notice({ tone = "blush", role, children }: { tone?: "blush" | "mint"; role?: "status" | "alert"; children: ReactNode }) {
  return (
    <p role={role} className={cx("rounded-input px-4 py-3.5 text-secondary font-semibold", tone === "mint" ? "bg-mint text-sea-deep" : "bg-blush text-navy")}>
      {children}
    </p>
  );
}
