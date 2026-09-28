import { cx } from "./cx";

// FERRY_BRAND §12.3. The §13 draft proposes a new first label; this one stands until Ryan approves it.
export const TRIP_STAGES = ["Snapped and sent", "Your insurer has it", "Money comes back"] as const;

type Stages = readonly [string, string, string];

// Three 8px segments, 6px apart: done is sea, pending blush; each fills over 400ms when its stage completes.
export function ProgressBar({ done, labels = TRIP_STAGES }: { done: 0 | 1 | 2 | 3; labels?: Stages }) {
  return (
    <ol className="grid grid-cols-3 gap-1.5" aria-label="Progress">
      {labels.map((label, i) => {
        const complete = i < done;
        return (
          <li key={label} className="flex min-w-0 flex-col gap-1.5" aria-current={i === done ? "step" : undefined}>
            <span aria-hidden="true" className="block h-2 overflow-hidden rounded-pill bg-blush">
              <span className={cx("block h-full rounded-pill bg-sea transition-[width] duration-400 ease-in-out motion-reduce:transition-none", complete ? "w-full" : "w-0")} />
            </span>
            <span className={cx("text-chip", complete ? "text-sea-deep" : "text-slate")}>
              {label}
              {complete && <span className="sr-only">, done</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
