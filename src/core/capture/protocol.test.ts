import { describe, expect, it } from "vitest";
import { FRAME_BYTES } from "./pcm";
import { ClientMessage, decodeFrame, encodeFrame, RelayMessage } from "./protocol";

const pcm = new Uint8Array(FRAME_BYTES).fill(7);

describe("capture frames", () => {
  it("round-trips a header and its PCM", () => {
    const frame = encodeFrame({ captureId: "cap_01", seq: 3, msOffset: 300 }, pcm);
    const decoded = decodeFrame(frame);
    expect(decoded?.header).toEqual({ captureId: "cap_01", seq: 3, msOffset: 300 });
    expect(decoded?.pcm).toEqual(pcm);
  });

  it("rejects malformed frames", () => {
    const good = encodeFrame({ captureId: "cap_01", seq: 0, msOffset: 0 }, pcm);
    expect(decodeFrame(good.slice(0, 1))).toBeNull();
    expect(decodeFrame(good.slice(0, good.byteLength - 1))).toBeNull();
    expect(decodeFrame(encodeFrame({ captureId: "cap_01", seq: 0, msOffset: 0 }, new Uint8Array(FRAME_BYTES + 2)))).toBeNull();
    expect(decodeFrame(encodeFrame({ captureId: "cap_01", seq: 0, msOffset: 0 }, new Uint8Array(0)))).toBeNull();
    const badHeader = new TextEncoder().encode(JSON.stringify({ captureId: "cap 01", seq: -1, msOffset: 0 }));
    const bytes = new Uint8Array(2 + badHeader.byteLength + 4);
    new DataView(bytes.buffer).setUint16(0, badHeader.byteLength, true);
    bytes.set(badHeader, 2);
    expect(decodeFrame(bytes)).toBeNull();
    expect(() => encodeFrame({ captureId: "x".repeat(65), seq: 0, msOffset: 0 }, pcm)).toThrow();
  });
});

describe("control messages", () => {
  it("parses a client end with a reason the client may give", () => {
    expect(ClientMessage.parse({ type: "end", reason: "backgrounded" })).toEqual({ type: "end", reason: "backgrounded" });
    expect(ClientMessage.safeParse({ type: "end", reason: "consent_withdrawn" }).success).toBe(false);
    expect(ClientMessage.safeParse({ type: "end", reason: "stopped", note: "x" }).success).toBe(false);
  });

  it("parses relay messages", () => {
    expect(RelayMessage.parse({ type: "ack", seq: 1, audioMs: 200 })).toEqual({ type: "ack", seq: 1, audioMs: 200 });
    expect(RelayMessage.parse({ type: "ready", captureId: "cap_01", audioMs: 0 }).type).toBe("ready");
  });
});
