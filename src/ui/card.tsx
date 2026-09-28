import type { ReactNode } from "react";
import { cx } from "./cx";

// FERRY_BRAND §6: white on cream and flat, depth from layering alone. lg for hero and detail, sm for list rows.
export function Card({ size = "lg", as: Tag = "div", className, children }: { size?: "lg" | "sm"; as?: "div" | "section" | "article" | "li"; className?: string; children: ReactNode }) {
  return <Tag className={cx("flex flex-col bg-white", size === "lg" ? "gap-3.5 rounded-card p-5.5" : "gap-2.5 rounded-card-sm px-4.5 py-4", className)}>{children}</Tag>;
}
