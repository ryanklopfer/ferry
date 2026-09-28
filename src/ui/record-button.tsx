"use client";

import { Mic, Square } from "lucide-react";
import { useId } from "react";
import { cx } from "./cx";
import { Icon } from "./icon";

const BARS = 5;

export const clockText = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// The record screen's one primary action: an 80px peach button, a level meter and the elapsed time.
// Disabled, it says why (no recording consent), and dictation or typing stays available beside it.
export function RecordButton({
  recording,
  elapsedMs,
  level,
  disabledReason,
  onToggle,
}: {
  recording: boolean;
  elapsedMs: number;
  level: number;
  disabledReason?: string;
  onToggle?: () => void;
}) {
  const reasonId = useId();
  const lit = recording ? Math.round(Math.min(1, Math.max(0, level)) * BARS) : 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        data-variant="primary"
        aria-label={recording ? "Stop recording" : "Start recording"}
        aria-describedby={disabledReason ? reasonId : undefined}
        disabled={Boolean(disabledReason)}
        onClick={onToggle}
        className="flex size-20 cursor-pointer items-center justify-center rounded-pill bg-peach text-navy transition-transform duration-120 active:scale-97 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:bg-mist disabled:text-slate"
      >
        <Icon icon={recording ? Square : Mic} size={32} />
      </button>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-6 items-end gap-1">
          {Array.from({ length: BARS }, (_, i) => (
            <span key={i} className={cx("w-1.5 rounded-pill", i < lit ? "bg-navy" : "bg-mist")} style={{ height: `${((i + 1) / BARS) * 100}%` }} />
          ))}
        </span>
        <span role="timer" aria-label="Recorded" className="font-display text-amount tabular-nums">
          {clockText(elapsedMs)}
        </span>
      </div>
      {disabledReason && (
        <p id={reasonId} className="text-center text-caption text-slate">
          {disabledReason}
        </p>
      )}
    </div>
  );
}
