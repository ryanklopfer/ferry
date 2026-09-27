import { describe, expect, it } from "vitest";
import { gapsFrom, type Interval } from "./gaps";

const T = Date.UTC(2026, 8, 29, 18, 0, 0);
const s = (sec: number) => T + sec * 1000;

describe("gapsFrom", () => {
  it("finds no gaps in one continuous interval, or in none", () => {
    expect(gapsFrom([{ startedAt: s(0), endedAt: s(300), endReason: "stopped" }])).toEqual([]);
    expect(gapsFrom([{ startedAt: s(0), endedAt: null, endReason: null }])).toEqual([]);
    expect(gapsFrom([])).toEqual([]);
  });

  it("ignores a 1 s blip", () => {
    const intervals: Interval[] = [
      { startedAt: s(0), endedAt: s(60), endReason: "disconnected" },
      { startedAt: s(61), endedAt: s(120), endReason: "stopped" },
    ];
    expect(gapsFrom(intervals)).toEqual([]);
  });

  it("reports two gaps with their reasons and durations, in order", () => {
    const intervals: Interval[] = [
      { startedAt: s(200), endedAt: s(300), endReason: "backgrounded" },
      { startedAt: s(0), endedAt: s(100), endReason: "interrupted" },
      { startedAt: s(130), endedAt: s(199), endReason: "disconnected" },
      { startedAt: s(345), endedAt: null, endReason: null },
    ];
    expect(gapsFrom(intervals)).toEqual([
      { from: s(100), to: s(130), durationMs: 30_000, reason: "interrupted" },
      { from: s(300), to: s(345), durationMs: 45_000, reason: "backgrounded" },
    ]);
  });

  it("honors a custom threshold and treats a missing reason as a disconnect", () => {
    const intervals: Interval[] = [
      { startedAt: s(0), endedAt: s(10), endReason: null },
      { startedAt: s(11), endedAt: s(20), endReason: "stopped" },
    ];
    expect(gapsFrom(intervals, 500)).toEqual([{ from: s(10), to: s(11), durationMs: 1_000, reason: "disconnected" }]);
  });
});
