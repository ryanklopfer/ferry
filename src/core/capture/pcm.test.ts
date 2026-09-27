import { describe, expect, it } from "vitest";
import { downsampleToS16, FRAME_BYTES, FRAME_SAMPLES, msForBytes, toS16le } from "./pcm";

const sine = (rate: number, hz: number, amplitude: number, ms = 100) => Float32Array.from({ length: (rate * ms) / 1000 }, (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / rate));

const zeroCrossings = (s: Int16Array) => s.reduce((n, v, i) => (i > 0 && Math.sign(v) !== Math.sign(s[i - 1]) && v !== 0 ? n + 1 : n), 0);

describe("downsampleToS16", () => {
  it.each([48_000, 44_100])("turns a 100 ms frame at %i Hz into 1,600 samples of 16 kHz audio", (rate) => {
    const out = downsampleToS16(sine(rate, 440, 0.5), rate);
    expect(out).toBeInstanceOf(Int16Array);
    expect(out.length).toBe(FRAME_SAMPLES);
    expect(FRAME_SAMPLES).toBe(1_600);
    const peak = Math.max(...out.map(Math.abs));
    expect(peak).toBeGreaterThan(15_500);
    expect(peak).toBeLessThan(16_500);
    // 440 Hz over 100 ms crosses zero 88 times.
    expect(zeroCrossings(out)).toBeGreaterThanOrEqual(86);
    expect(zeroCrossings(out)).toBeLessThanOrEqual(90);
  });

  it.each([48_000, 44_100])("clips an over-range sine at %i Hz to the int16 range", (rate) => {
    const out = downsampleToS16(sine(rate, 440, 3), rate);
    expect(out.length).toBe(1_600);
    expect(Math.max(...out)).toBe(32_767);
    expect(Math.min(...out)).toBe(-32_768);
  });

  it("passes 16 kHz through unchanged in length", () => {
    expect(downsampleToS16(sine(16_000, 440, 0.5), 16_000).length).toBe(1_600);
  });

  it("refuses anything but one 100 ms frame, and rates below 16 kHz", () => {
    expect(() => downsampleToS16(new Float32Array(128), 48_000)).toThrow(RangeError);
    expect(() => downsampleToS16(new Float32Array(800), 8_000)).toThrow(RangeError);
  });
});

describe("toS16le", () => {
  it("packs a frame into 3,200 little-endian bytes", () => {
    const samples = new Int16Array(FRAME_SAMPLES);
    samples[0] = 0x1234;
    samples[1] = -2;
    const bytes = toS16le(samples);
    expect(bytes.byteLength).toBe(FRAME_BYTES);
    expect(FRAME_BYTES).toBe(3_200);
    expect([...bytes.slice(0, 4)]).toEqual([0x34, 0x12, 0xfe, 0xff]);
  });

  it("counts 32 bytes per millisecond", () => {
    expect(msForBytes(FRAME_BYTES)).toBe(100);
    expect(msForBytes(FRAME_BYTES * 50)).toBe(5_000);
  });
});
