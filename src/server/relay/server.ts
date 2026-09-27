import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";
import { type RawData, type WebSocket, WebSocketServer } from "ws";
import { type EndReason, type Gap, gapsFrom, type Interval } from "@/core/capture/gaps";
import { msForBytes } from "@/core/capture/pcm";
import { CaptureId, ClientMessage, CLOSE, decodeFrame, type RelayMessage } from "@/core/capture/protocol";
import { log } from "@/server/log";
import { verifyRelayToken } from "./token";

// The relay counts audio and keeps connection intervals in memory. It never writes audio or text to
// disk, the database or logs; logs carry the capture id and counts only.

type Capture = { subject: string; bytes: number; intervals: Interval[]; socket: WebSocket | null };

export type CaptureStats = { audioMs: number; intervals: Interval[]; gaps: Gap[] };
export type Relay = { port: number; stats(captureId: string): CaptureStats | null; close(): Promise<void> };
export type RelayOptions = { port: number; secret: string; host?: string; now?: () => number };

const PATH = /^\/ws\/capture\/([^/]+)$/;
const MAX_PAYLOAD = 4096;
const STATUS_TEXT: Record<number, string> = { 401: "Unauthorized", 404: "Not Found" };

function refuse(socket: Duplex, httpStatus: 401 | 404, code: string) {
  log("relay.refused", { code, httpStatus });
  socket.end(`HTTP/1.1 ${httpStatus} ${STATUS_TEXT[httpStatus]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

const bytesOf = (data: RawData): Uint8Array => (Array.isArray(data) ? Buffer.concat(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data);

function control(data: RawData): ClientMessage | null {
  try {
    const parsed = ClientMessage.safeParse(JSON.parse(Buffer.from(bytesOf(data)).toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const send = (ws: WebSocket, message: RelayMessage) => ws.send(JSON.stringify(message));

export async function startRelay({ port, secret, host = "127.0.0.1", now = Date.now }: RelayOptions): Promise<Relay> {
  const captures = new Map<string, Capture>();
  const server = http.createServer((_req, res) => res.writeHead(404).end());
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

  function attach(ws: WebSocket, captureId: string, subject: string) {
    let capture = captures.get(captureId);
    if (!capture) captures.set(captureId, (capture = { subject, bytes: 0, intervals: [], socket: null }));
    else if (capture.subject !== subject) return ws.close(CLOSE.invalidFrame, "wrong_subject");
    const c = capture;

    if (c.socket) {
      const older = c.socket;
      const last = c.intervals.at(-1);
      if (last && last.endedAt === null) Object.assign(last, { endedAt: now(), endReason: "disconnected" satisfies EndReason });
      c.socket = null;
      older.close(CLOSE.superseded, "superseded");
    }

    c.socket = ws;
    const interval: Interval = { startedAt: now(), endedAt: null, endReason: null };
    c.intervals.push(interval);
    let reason: EndReason = "disconnected";
    let ending = false;
    const live = () => c.socket === ws && !ending;

    ws.on("message", (data, isBinary) => {
      if (!live()) return;
      if (isBinary) {
        const frame = decodeFrame(bytesOf(data));
        if (!frame || frame.header.captureId !== captureId) return ws.close(CLOSE.invalidFrame, "invalid_frame");
        c.bytes += frame.pcm.byteLength;
        return send(ws, { type: "ack", seq: frame.header.seq, audioMs: msForBytes(c.bytes) });
      }
      const message = control(data);
      if (!message) return ws.close(CLOSE.invalidFrame, "invalid_frame");
      ending = true;
      reason = message.reason;
      ws.close(CLOSE.ended, message.reason);
    });
    ws.on("error", (e) => log("relay.socket_error", { captureId, error: e }));
    ws.on("close", () => {
      if (interval.endedAt === null) Object.assign(interval, { endedAt: now(), endReason: reason });
      if (c.socket === ws) c.socket = null;
      log("relay.closed", { captureId, ms: msForBytes(c.bytes), code: interval.endReason });
    });

    log("relay.connected", { captureId, count: c.intervals.length });
    send(ws, { type: "ready", captureId, audioMs: msForBytes(c.bytes) });
  }

  server.on("upgrade", (req, socket, head) => {
    socket.on("error", () => {});
    const url = new URL(req.url ?? "/", "http://relay");
    const id = PATH.exec(url.pathname)?.[1];
    if (!id || !CaptureId.safeParse(id).success) return refuse(socket, 404, "not_found");
    const verified = verifyRelayToken(url.searchParams.get("token"), secret, now());
    if (!verified.ok) return refuse(socket, 401, verified.code);
    if (verified.claims.captureId !== id) return refuse(socket, 401, "wrong_capture");
    const existing = captures.get(id);
    if (existing && existing.subject !== verified.claims.subject) return refuse(socket, 401, "wrong_subject");
    wss.handleUpgrade(req, socket, head, (ws) => attach(ws, id, verified.claims.subject));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  return {
    port: (server.address() as AddressInfo).port,
    stats(captureId) {
      const c = captures.get(captureId);
      return c ? { audioMs: msForBytes(c.bytes), intervals: c.intervals.map((i) => ({ ...i })), gaps: gapsFrom(c.intervals) } : null;
    },
    async close() {
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
