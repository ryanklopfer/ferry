import { describe, expect, it } from "vitest";
import { tone, wav } from "./wav";

describe("wav", () => {
  it("writes a 44-byte PCM header for mono 16-bit audio", () => {
    const bytes = wav(new Int16Array([1, -1]), 16_000);
    const v = new DataView(bytes.buffer);
    const ascii = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4));
    expect([ascii(0), ascii(8), ascii(12), ascii(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(v.getUint32(4, true)).toBe(36 + 4);
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint32(28, true)).toBe(32_000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(4);
    expect([v.getInt16(44, true), v.getInt16(46, true)]).toEqual([1, -1]);
  });

  it("renders 10 seconds of tone as 10 s of samples within range", () => {
    const samples = tone({ seconds: 10, hz: 440, sampleRate: 16_000 });
    expect(samples.length).toBe(160_000);
    expect(Math.max(...samples.slice(0, 1_000))).toBeGreaterThan(9_000);
    expect(wav(samples, 16_000).byteLength).toBe(44 + 320_000);
  });
});
