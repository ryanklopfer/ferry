import fs from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { FRAME_BYTES } from "@/core/capture/pcm";
import { CLOSE, encodeFrame, type RelayMessage } from "@/core/capture/protocol";
import { log } from "@/server/log";
import { startRelay, type Relay } from "./server";
import { issueRelayToken } from "./token";

vi.mock("@/server/log", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/log")>();
  return { ...actual, log: vi.fn(actual.log) };
});

const SECRET = "r".repeat(32);
const SUBJECT = "devRun:r1";
const MARKER = "PCM-MARKER-Samira-Haddad";
// Synthetic "audio" that spells a marker, so any copy of it in a log or file is findable.
const AUDIO = new Uint8Array(FRAME_BYTES).map((_, i) => MARKER.charCodeAt(i % MARKER.length));

let relay: Relay;
const open: WebSocket[] = [];

beforeAll(async () => {
  relay = await startRelay({ port: 0, secret: SECRET });
});
afterAll(() => relay.close());
afterEach(() => {
  for (const ws of open.splice(0)) {
    ws.on("error", () => {});
    ws.terminate();
  }
});

const url = (captureId: string, token: string | null) => `ws://127.0.0.1:${relay.port}/ws/capture/${captureId}${token === null ? "" : `?token=${encodeURIComponent(token)}`}`;
const token = (captureId: string, now = Date.now(), secret = SECRET) => issueRelayToken({ captureId, subject: SUBJECT }, secret, now);

type Client = { ws: WebSocket; messages: RelayMessage[]; closed: Promise<{ code: number; reason: string }> };

function connect(captureId: string, t: string | null = token(captureId)): Promise<Client> {
  const ws = new WebSocket(url(captureId, t));
  open.push(ws);
  const messages: RelayMessage[] = [];
  ws.on("message", (data, isBinary) => {
    if (!isBinary) messages.push(JSON.parse(data.toString()));
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) => ws.on("close", (code, reason) => resolve({ code, reason: reason.toString() })));
  return new Promise((resolve, reject) => {
    ws.on("open", () => resolve({ ws, messages, closed }));
    ws.on("unexpected-response", (_req, res) => reject(new Error(`refused ${res.statusCode}`)));
    ws.on("error", reject);
  });
}

const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
};

async function send(client: Client, captureId: string, frames: number, from = 0) {
  for (let seq = from; seq < from + frames; seq++) client.ws.send(encodeFrame({ captureId, seq, msOffset: seq * 100 }, AUDIO));
  await until(() => client.messages.some((m) => m.type === "ack" && m.seq === from + frames - 1));
}

const acks = (client: Client) => client.messages.filter((m) => m.type === "ack");

describe("capture relay", () => {
  it("refuses missing, expired, forged and wrong-capture tokens", async () => {
    await expect(connect("cap_missing", null)).rejects.toThrow("refused 401");
    await expect(connect("cap_expired", token("cap_expired", Date.now() - 61_000))).rejects.toThrow("refused 401");
    await expect(connect("cap_forged", token("cap_forged", Date.now(), "f".repeat(32)))).rejects.toThrow("refused 401");
    await expect(connect("cap_wrong", token("cap_other"))).rejects.toThrow("refused 401");
    for (const id of ["cap_missing", "cap_expired", "cap_forged", "cap_wrong", "cap_other"]) expect(relay.stats(id)).toBeNull();
  });

  it("refuses paths other than /ws/capture/:captureId", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${relay.port}/elsewhere?token=${token("cap_x")}`);
    open.push(ws);
    await expect(new Promise((_, reject) => ws.on("unexpected-response", (_r, res) => reject(new Error(`refused ${res.statusCode}`))))).rejects.toThrow("refused 404");
  });

  it("counts 50 frames of 100 ms as 5,000 ms", async () => {
    const client = await connect("cap_count");
    await until(() => client.messages.some((m) => m.type === "ready"));
    expect(client.messages[0]).toEqual({ type: "ready", captureId: "cap_count", audioMs: 0 });
    await send(client, "cap_count", 50);
    expect(client.messages.at(-1)).toEqual({ type: "ack", seq: 49, audioMs: 5_000 });
    expect(relay.stats("cap_count")?.audioMs).toBe(5_000);
  });

  it("closes a connection that sends a frame for another capture or a malformed frame", async () => {
    const a = await connect("cap_strict");
    a.ws.send(encodeFrame({ captureId: "cap_else", seq: 0, msOffset: 0 }, AUDIO));
    expect((await a.closed).code).toBe(CLOSE.invalidFrame);
    const b = await connect("cap_strict");
    b.ws.send(new Uint8Array([1, 2, 3]));
    expect((await b.closed).code).toBe(CLOSE.invalidFrame);
    const c = await connect("cap_strict");
    c.ws.send("not json");
    expect((await c.closed).code).toBe(CLOSE.invalidFrame);
    expect(relay.stats("cap_strict")?.audioMs).toBe(0);
  });

  it("closes the first connection when a second one opens for the same capture", async () => {
    const first = await connect("cap_twice");
    await send(first, "cap_twice", 10);
    const second = await connect("cap_twice");
    expect(await first.closed).toEqual({ code: CLOSE.superseded, reason: "superseded" });
    expect(second.ws.readyState).toBe(WebSocket.OPEN);
    await until(() => second.messages.some((m) => m.type === "ready"));
    expect(second.messages[0]).toEqual({ type: "ready", captureId: "cap_twice", audioMs: 1_000 });
    await send(second, "cap_twice", 5, 10);
    expect(relay.stats("cap_twice")?.audioMs).toBe(1_500);
    expect(relay.stats("cap_twice")?.intervals).toEqual([
      { startedAt: expect.any(Number), endedAt: expect.any(Number), endReason: "disconnected" },
      { startedAt: expect.any(Number), endedAt: null, endReason: null },
    ]);
  });

  it("counts a duplicate or resent frame once, and acks it", async () => {
    const first = await connect("cap_dupes");
    await send(first, "cap_dupes", 3);
    for (let i = 0; i < 3; i++) first.ws.send(encodeFrame({ captureId: "cap_dupes", seq: 2, msOffset: 200 }, AUDIO));
    await until(() => acks(first).length === 6);
    expect(acks(first).slice(3)).toEqual(Array(3).fill({ type: "ack", seq: 2, audioMs: 300 }));

    // After a reconnect the client resends what it never saw acked, then carries on.
    const second = await connect("cap_dupes");
    await send(second, "cap_dupes", 3, 1);
    expect(acks(second)).toEqual([
      { type: "ack", seq: 1, audioMs: 300 },
      { type: "ack", seq: 2, audioMs: 300 },
      { type: "ack", seq: 3, audioMs: 400 },
    ]);
    // A higher seq whose audio overlaps what was already counted is not counted either.
    second.ws.send(encodeFrame({ captureId: "cap_dupes", seq: 9, msOffset: 100 }, AUDIO));
    await until(() => acks(second).length === 4);
    expect(relay.stats("cap_dupes")?.audioMs).toBe(400);
  });

  it("lets a token open one connection only, so a copied token can't take over a capture", async () => {
    const t = token("cap_once");
    const first = await connect("cap_once", t);
    await expect(connect("cap_once", t)).rejects.toThrow("refused 401");
    expect(first.ws.readyState).toBe(WebSocket.OPEN);
    first.ws.close();
    await first.closed;
    await expect(connect("cap_once", t)).rejects.toThrow("refused 401");
    expect(relay.stats("cap_once")?.intervals).toHaveLength(1);
  });

  it("closes a connection that sends more than 4 KiB in one message", async () => {
    const client = await connect("cap_big");
    client.ws.send(new Uint8Array(10_000));
    expect((await client.closed).code).toBe(CLOSE.tooBig);
    expect(relay.stats("cap_big")?.audioMs).toBe(0);
  });

  it("refuses a second connection for the same capture under a different subject", async () => {
    await connect("cap_owned");
    const other = issueRelayToken({ captureId: "cap_owned", subject: "devRun:r2" }, SECRET, Date.now());
    await expect(connect("cap_owned", other)).rejects.toThrow("refused 401");
  });

  it("keeps connected intervals, with the client's reason for ending, and reports gaps", async () => {
    let t = Date.UTC(2026, 8, 29, 18, 0, 0);
    const timed = await startRelay({ port: 0, secret: SECRET, now: () => t });
    try {
      const at = (id: string) => `ws://127.0.0.1:${timed.port}/ws/capture/${id}?token=${encodeURIComponent(issueRelayToken({ captureId: id, subject: SUBJECT }, SECRET, t))}`;
      const a = new WebSocket(at("cap_gap"));
      open.push(a);
      await new Promise((r) => a.on("open", r));
      t += 60_000;
      a.send(JSON.stringify({ type: "end", reason: "backgrounded" }));
      await new Promise((r) => a.on("close", r));
      t += 30_000;
      const b = new WebSocket(at("cap_gap"));
      open.push(b);
      await new Promise((r) => b.on("open", r));
      const stats = timed.stats("cap_gap");
      expect(stats?.intervals[0].endReason).toBe("backgrounded");
      expect(stats?.gaps).toEqual([{ from: Date.UTC(2026, 8, 29, 18, 1, 0), to: Date.UTC(2026, 8, 29, 18, 1, 30), durationMs: 30_000, reason: "backgrounded" }]);
    } finally {
      await timed.close();
    }
  });

  it("keeps the client's reason for ending when it reconnects before the old socket has finished closing", async () => {
    let t = Date.UTC(2026, 8, 29, 18, 0, 0);
    const timed = await startRelay({ port: 0, secret: SECRET, now: () => t });
    try {
      const at = (id: string) => `ws://127.0.0.1:${timed.port}/ws/capture/${id}?token=${encodeURIComponent(issueRelayToken({ captureId: id, subject: SUBJECT }, SECRET, t))}`;
      const a = new WebSocket(at("cap_race"));
      open.push(a);
      await new Promise((r) => a.on("open", r));
      t += 60_000;
      a.send(JSON.stringify({ type: "end", reason: "backgrounded" }));
      // The old client stops reading, so the relay's close handshake with it can't finish.
      (a as unknown as { _socket: { pause(): void } })._socket.pause();
      await until(() => timed.stats("cap_race")?.intervals[0].endedAt !== null);
      t += 5_000;
      const b = new WebSocket(at("cap_race"));
      open.push(b);
      await new Promise((r) => b.on("open", r));
      const stats = timed.stats("cap_race");
      expect(stats?.intervals.map((i) => i.endReason)).toEqual(["backgrounded", null]);
      expect(stats?.gaps).toEqual([{ from: Date.UTC(2026, 8, 29, 18, 1, 0), to: Date.UTC(2026, 8, 29, 18, 1, 5), durationMs: 5_000, reason: "backgrounded" }]);
    } finally {
      await timed.close();
    }
  });

  it("never writes audio or text to disk, and logs no audio bytes", async () => {
    const methods = ["writeFile", "writeFileSync", "appendFile", "appendFileSync", "createWriteStream", "write", "writeSync", "writev", "writevSync", "copyFile", "copyFileSync", "rename", "renameSync", "mkdir", "mkdirSync", "open", "openSync"] as const;
    const fsSpies = methods.map((m) => vi.spyOn(fs, m));
    const promiseSpies = (["writeFile", "appendFile", "open", "mkdir", "copyFile", "rename"] as const).map((m) => vi.spyOn(fs.promises, m));
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m));
    vi.mocked(log).mockClear();
    try {
      const client = await connect("cap_quiet");
      await send(client, "cap_quiet", 20);
      client.ws.send(JSON.stringify({ type: "end", reason: "stopped" }));
      await client.closed;
      await until(() => relay.stats("cap_quiet")?.intervals[0].endedAt !== null);

      for (const spy of [...fsSpies, ...promiseSpies]) expect(spy).not.toHaveBeenCalled();
      expect(vi.mocked(log).mock.calls.length).toBeGreaterThan(0);
      const logged = [...vi.mocked(log).mock.calls, ...consoleSpies.flatMap((s) => s.mock.calls)];
      for (const args of logged) {
        for (const arg of args) expect(arg instanceof Uint8Array || arg instanceof ArrayBuffer).toBe(false);
        const text = JSON.stringify(args);
        expect(text).not.toContain(MARKER.slice(0, 10));
        expect(text).not.toContain(Buffer.from(AUDIO.subarray(0, 24)).toString("base64"));
      }
    } finally {
      for (const spy of [...fsSpies, ...promiseSpies, ...consoleSpies]) spy.mockRestore();
    }
  });
});
