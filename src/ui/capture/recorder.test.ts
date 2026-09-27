import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FRAME_BYTES, FRAME_MS } from "@/core/capture/pcm";
import { CLOSE } from "@/core/capture/protocol";
import { createRecorder, GAP_MS, type RecorderSnapshot } from "./recorder";

// Browser APIs faked just far enough to drive the recorder with a controlled clock: frames are pushed through the
// worklet node's port by hand, one per 100 ms of fake time.

class FakeTrack extends EventTarget {
  readyState = "live";
  stop() {
    this.readyState = "ended";
  }
}

class FakeContext extends EventTarget {
  static last: FakeContext;
  state = "running";
  audioWorklet = { addModule: async () => {} };
  destination = {};
  constructor() {
    super();
    FakeContext.last = this;
  }
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} };
  }
  async resume() {
    this.set("running");
  }
  async close() {
    this.state = "closed";
  }
  set(state: string) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeNode extends EventTarget {
  static last: FakeNode;
  port = { onmessage: null as null | ((e: { data: ArrayBuffer }) => void), close() {} };
  constructor() {
    super();
    FakeNode.last = this;
  }
  connect() {}
  disconnect() {}
}

class FakeSocket extends EventTarget {
  static OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = 0;
  binaryType = "blob";
  sent: (Uint8Array | string)[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(readonly url: URL) {
    super();
    FakeSocket.all.push(this);
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  send(data: Uint8Array | string) {
    this.sent.push(data);
  }
  relay(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  close(code: number = CLOSE.ended) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code });
    this.dispatchEvent(new Event("close"));
  }
}

let track: FakeTrack;
let snapshot: RecorderSnapshot;
let grants: number;

beforeEach(() => {
  vi.useFakeTimers({ now: 1_800_000_000_000 });
  track = new FakeTrack();
  FakeSocket.all = [];
  grants = 0;
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("AudioWorkletNode", FakeNode);
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getAudioTracks: () => [track], getTracks: () => [track] }) } });
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("location", { href: "https://phone.example.test/dev/mic" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function recorder(grant = async () => ({ token: `t${++grants}`, url: "/ws/capture/cap_unit" })) {
  return createRecorder({ captureId: "cap_unit", grant, onChange: (s) => (snapshot = s) });
}

// Advance fake time by ms, with the worklet posting a frame every 100 ms.
async function play(ms: number) {
  for (let t = 0; t < ms; t += FRAME_MS) {
    await vi.advanceTimersByTimeAsync(FRAME_MS);
    FakeNode.last.port.onmessage?.({ data: new ArrayBuffer(FRAME_BYTES) });
  }
}

// Stop waits up to 5 s for acks that never come here, so fake time runs on while it drains.
async function stop(r: { stop(): Promise<void> }) {
  const stopping = r.stop();
  await vi.advanceTimersByTimeAsync(8_000);
  await stopping;
}

async function started(r = recorder()) {
  await r.start();
  expect(snapshot.state).toBe("recording");
  return r;
}

describe("recorder gaps", () => {
  it("records nothing as lost while audio flows", async () => {
    const r = await started();
    await play(3_000);
    await stop(r);
    expect(snapshot.producedMs).toBe(3_000);
    expect(snapshot.gaps).toEqual([]);
  });

  it("shows a muted mic track as a gap, even though the context keeps delivering frames of silence", async () => {
    const r = await started();
    await play(1_000);
    track.dispatchEvent(new Event("mute"));
    await play(2_000);
    expect(snapshot.micLive).toBe(false);
    track.dispatchEvent(new Event("unmute"));
    await play(1_000);
    await vi.advanceTimersByTimeAsync(250);

    expect(snapshot.producedMs).toBe(2_000);
    expect(snapshot.gaps).toHaveLength(1);
    expect(snapshot.gaps[0].cause).toBe("track_muted");
    expect(snapshot.gaps[0].durationMs).toBeGreaterThanOrEqual(2_000);
    expect(snapshot.gaps[0].durationMs).toBeLessThan(2_000 + GAP_MS / 2);
    await stop(r);
  });

  it("shows an ended mic track as a gap at stop", async () => {
    const r = await started();
    await play(1_000);
    track.dispatchEvent(new Event("ended"));
    await play(2_000);
    await stop(r);
    expect(snapshot.gaps.map((g) => g.cause)).toEqual(["track_ended"]);
    expect(snapshot.gaps[0].durationMs).toBeGreaterThanOrEqual(2_000);
  });

  it("shows a suspended audio context as a gap with its cause once frames flow again", async () => {
    const r = await started();
    await play(1_000);
    FakeContext.last.set("suspended");
    await vi.advanceTimersByTimeAsync(2_000);
    FakeContext.last.set("running");
    await play(500);

    expect(snapshot.gaps).toHaveLength(1);
    expect(snapshot.gaps[0].cause).toBe("context_suspended");
    expect(snapshot.gaps[0].durationMs).toBeGreaterThanOrEqual(2_000);
    await stop(r);
  });

  it("shows audio that never arrives as a gap, from the moment recording started", async () => {
    const r = await started();
    await vi.advanceTimersByTimeAsync(3_000);
    await stop(r);
    expect(snapshot.producedMs).toBe(0);
    expect(snapshot.gaps).toHaveLength(1);
    expect(snapshot.gaps[0].durationMs).toBeGreaterThanOrEqual(3_000);
  });

  it("names a worklet processor error as the cause", async () => {
    const r = await started();
    await play(1_000);
    FakeNode.last.dispatchEvent(new Event("processorerror"));
    await vi.advanceTimersByTimeAsync(2_000);
    await stop(r);
    expect(snapshot.gaps.map((g) => g.cause)).toEqual(["processor_error"]);
  });
});

describe("recorder stop", () => {
  it("keeps a single token request in flight while it waits for the relay", async () => {
    let pending = 0;
    const r = await started(
      recorder(() => {
        pending++;
        return new Promise(() => {});
      }),
    );
    await play(500);
    const stopping = r.stop();
    await vi.advanceTimersByTimeAsync(6_000);
    await stopping;
    expect(pending).toBe(1);
    expect(snapshot.state).toBe("stopped");
  });

  it("sends every frame, counts the relay's acks and ends the capture", async () => {
    const r = await started();
    await vi.advanceTimersByTimeAsync(0);
    FakeSocket.all[0].open();
    await play(1_000);
    const socket = FakeSocket.all[0];
    expect(socket.sent.filter((m) => m instanceof Uint8Array)).toHaveLength(10);
    socket.relay({ type: "ack", seq: 9, audioMs: 1_000 });
    const stopping = r.stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(socket.sent.at(-1)).toBe(JSON.stringify({ type: "end", reason: "stopped" }));
    socket.close(CLOSE.ended);
    await stopping;
    expect(snapshot).toMatchObject({ state: "stopped", relayMs: 1_000, producedMs: 1_000, unackedFrames: 0 });
  });

  it("does not overwrite a failure that lands while it is draining", async () => {
    const r = await started();
    await vi.advanceTimersByTimeAsync(0);
    FakeSocket.all[0].open();
    await play(500);
    const stopping = r.stop();
    await vi.advanceTimersByTimeAsync(100);
    FakeSocket.all[0].close(CLOSE.superseded);
    await vi.advanceTimersByTimeAsync(6_000);
    await stopping;
    expect(snapshot).toMatchObject({ state: "failed", error: "superseded" });
  });
});
