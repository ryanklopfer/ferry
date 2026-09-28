import type { ReactNode } from "react";
import { cx } from "./cx";

export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col gap-4">{children}</ol>;
}

// FERRY_BRAND §6: a 12px dot, sea when done, a 2px blush ring while pending.
export function TimelineRow({ title, time, done }: { title: string; time?: string; done: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className={cx("mt-1.5 size-3 shrink-0 rounded-pill", done ? "bg-sea" : "border-2 border-blush")} />
      <span className="flex min-w-0 flex-col">
        <span className="text-secondary font-bold">
          {title}
          {!done && <span className="sr-only">, not yet</span>}
        </span>
        {time && <span className="text-caption text-slate">{time}</span>}
      </span>
    </li>
  );
}
