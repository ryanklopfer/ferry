import { z } from "zod";
import { FRAME_BYTES } from "./pcm";

// Browser → relay. Binary messages are audio frames: a u16 little-endian header length, the JSON
// header, then up to one 100 ms frame of 16 kHz s16le PCM. Text messages are JSON control messages.
// seq and msOffset run across every connection of a capture: after a reconnect the client resends
// unacked frames with their original seq and msOffset, and the relay counts each frame once.

export const CaptureId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const FrameHeader = z.strictObject({
  captureId: CaptureId,
  seq: z.int().min(0),
  msOffset: z.int().min(0),
});
export type FrameHeader = z.infer<typeof FrameHeader>;

// The client may say why it is closing; limit and consent_withdrawn are decided only by the relay.
export const ClientMessage = z.discriminatedUnion("type", [z.strictObject({ type: z.literal("end"), reason: z.enum(["stopped", "interrupted", "backgrounded"]) })]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export const RelayMessage = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ready"), captureId: CaptureId, audioMs: z.number().min(0) }),
  z.strictObject({ type: z.literal("ack"), seq: z.int().min(0), audioMs: z.number().min(0) }),
]);
export type RelayMessage = z.infer<typeof RelayMessage>;

export const CLOSE = { superseded: 4001, invalidFrame: 4002, ended: 1000, tooBig: 1009 } as const;

const MAX_HEADER_BYTES = 256;

export function encodeFrame(header: FrameHeader, pcm: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(FrameHeader.parse(header)));
  const out = new Uint8Array(2 + json.byteLength + pcm.byteLength);
  new DataView(out.buffer).setUint16(0, json.byteLength, true);
  out.set(json, 2);
  out.set(pcm, 2 + json.byteLength);
  return out;
}

export function decodeFrame(bytes: Uint8Array): { header: FrameHeader; pcm: Uint8Array } | null {
  if (bytes.byteLength < 2) return null;
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0, true);
  if (headerLength > MAX_HEADER_BYTES || bytes.byteLength < 2 + headerLength) return null;
  const pcm = bytes.subarray(2 + headerLength);
  if (pcm.byteLength === 0 || pcm.byteLength > FRAME_BYTES || pcm.byteLength % 2 !== 0) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(2, 2 + headerLength)));
  } catch {
    return null;
  }
  const header = FrameHeader.safeParse(raw);
  return header.success ? { header: header.data, pcm } : null;
}
