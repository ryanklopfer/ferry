export const END_REASONS = ["stopped", "disconnected", "interrupted", "backgrounded", "limit", "consent_withdrawn"] as const;
export type EndReason = (typeof END_REASONS)[number];

// Times are epoch milliseconds. An interval still connected has endedAt null.
export type Interval = { startedAt: number; endedAt: number | null; endReason: EndReason | null };
export type Gap = { from: number; to: number; durationMs: number; reason: EndReason };

export function gapsFrom(intervals: Interval[], minGapMs = 2000): Gap[] {
  const sorted = [...intervals].sort((a, b) => a.startedAt - b.startedAt);
  const gaps: Gap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (prev.endedAt === null) continue;
    const durationMs = sorted[i].startedAt - prev.endedAt;
    if (durationMs >= minGapMs) gaps.push({ from: prev.endedAt, to: sorted[i].startedAt, durationMs, reason: prev.endReason ?? "disconnected" });
  }
  return gaps;
}
