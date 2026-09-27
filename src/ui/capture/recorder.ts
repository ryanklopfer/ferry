import { FRAME_MS } from "@/core/capture/pcm";
import { CLOSE, encodeFrame, RelayMessage } from "@/core/capture/protocol";

// Browser side of a capture: mic → AudioContext → PCM worklet → WebSocket to the relay. No MediaRecorder
// (HealthScribe streaming takes only pcm, ogg-opus or flac) and nothing is kept once the relay has acked it.
// Loss is measured against the wall clock, so a lock, call or app switch that stops the audio shows as a gap
// with its cause instead of disappearing. Frames that arrive while the mic track is muted or ended are silence
// the browser renders in place of the mic, so they are not audio: they are left out and show as a gap.

export const GAP_MS = 1_000;
const TICK_MS = 250;
const FLOWING_MS = 500;
// Frames kept for resending after a reconnect: five minutes. Older ones are dropped and counted.
const MAX_UNACKED = 3_000;
const DISRUPTIONS = ["hidden", "pagehide", "context_suspended", "context_interrupted", "context_closed", "track_muted", "track_ended", "processor_error"];

export type RecorderState = "idle" | "starting" | "recording" | "stopping" | "stopped" | "failed";
export type WakeLockStatus = "none" | "held" | "released" | "unsupported" | "failed";
export type RecorderEvent = { at: number; kind: string };
export type RecorderGap = { from: number; to: number; durationMs: number; cause: string };
export type RecorderSnapshot = {
  state: RecorderState;
  error: string | null;
  startedAt: number | null;
  stoppedAt: number | null;
  producedMs: number;
  relayMs: number;
  droppedMs: number;
  unackedFrames: number;
  connected: boolean;
  micLive: boolean;
  contextState: string;
  wakeLock: WakeLockStatus;
  lastFrameAt: number | null;
  gaps: RecorderGap[];
  events: RecorderEvent[];
};
export type RelayGrant = { token: string; url: string };
export type RecorderOptions = {
  captureId: string;
  grant: () => Promise<RelayGrant>;
  onChange: (snapshot: RecorderSnapshot) => void;
  workletUrl?: string;
  now?: () => number;
};
export type Recorder = { start(): Promise<void>; resume(): Promise<void>; stop(): Promise<void> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createRecorder({ captureId, grant, onChange, workletUrl = "/worklets/pcm.js", now = Date.now }: RecorderOptions): Recorder {
  const s: RecorderSnapshot = {
    state: "idle",
    error: null,
    startedAt: null,
    stoppedAt: null,
    producedMs: 0,
    relayMs: 0,
    droppedMs: 0,
    unackedFrames: 0,
    connected: false,
    micLive: false,
    contextState: "none",
    wakeLock: "none",
    lastFrameAt: null,
    gaps: [],
    events: [],
  };
  let ctx: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let ws: WebSocket | null = null;
  let connecting = false;
  let wakeLock: WakeLockSentinel | null = null;
  let seq = 0;
  let lostMs = 0;
  let ticker: ReturnType<typeof setInterval> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectDelay = 500;
  const unacked: { seq: number; bytes: Uint8Array }[] = [];
  const cleanups: (() => void)[] = [];

  const emit = () => onChange({ ...s, gaps: [...s.gaps], events: [...s.events] });
  const event = (kind: string) => {
    s.events.push({ at: now(), kind });
    if (s.events.length > 300) s.events.shift();
    emit();
  };
  const live = () => s.state === "recording" || s.state === "stopping";
  function listen(target: EventTarget, type: string, fn: () => void) {
    target.addEventListener(type, fn);
    cleanups.push(() => target.removeEventListener(type, fn));
  }

  const causeOf = (from: number, to: number) => s.events.find((e) => DISRUPTIONS.includes(e.kind) && e.at >= from - GAP_MS && e.at <= to)?.kind ?? "unexplained";

  // Audio missing = wall time since recording started minus audio produced minus gaps already recorded, so audio
  // that never arrives at all is a gap too. It is recorded only once frames flow again (or at stop), so a burst of
  // frames queued while the page was frozen counts as audio, not as a gap.
  function checkLoss(stopping = false) {
    if (s.startedAt === null) return;
    const t = now();
    if (t - (s.lastFrameAt ?? s.startedAt) >= FLOWING_MS && !stopping) return;
    const missing = t - s.startedAt - s.producedMs - lostMs;
    if (missing < GAP_MS) return;
    const from = t - missing;
    s.gaps.push({ from, to: from + missing, durationMs: Math.round(missing), cause: causeOf(from, from + missing) });
    lostMs += missing;
    emit();
  }

  function onFrame(buffer: ArrayBuffer) {
    if (!live() || !s.micLive) return;
    const t = now();
    s.producedMs += FRAME_MS;
    s.lastFrameAt = t;
    const frame = { seq, bytes: encodeFrame({ captureId, seq, msOffset: seq * FRAME_MS }, new Uint8Array(buffer)) };
    seq++;
    unacked.push(frame);
    if (unacked.length > MAX_UNACKED) {
      unacked.shift();
      s.droppedMs += FRAME_MS;
    }
    s.unackedFrames = unacked.length;
    if (ws?.readyState === WebSocket.OPEN) ws.send(frame.bytes);
    emit();
  }

  function onRelayMessage(data: unknown) {
    if (typeof data !== "string") return;
    let parsed;
    try {
      parsed = RelayMessage.safeParse(JSON.parse(data));
    } catch {
      return;
    }
    if (!parsed.success) return;
    const m = parsed.data;
    s.relayMs = m.audioMs;
    if (m.type === "ack") while (unacked.length && unacked[0].seq <= m.seq) unacked.shift();
    s.unackedFrames = unacked.length;
    emit();
  }

  function scheduleReconnect() {
    if (!live() || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 5_000);
  }

  // Each connection needs a fresh single-use token; unacked frames are resent with their original seq.
  async function connect() {
    if (!live() || ws || connecting) return;
    connecting = true;
    let g: RelayGrant;
    try {
      g = await grant();
    } catch {
      event("token_failed");
      return scheduleReconnect();
    } finally {
      connecting = false;
    }
    if (!live() || ws) return;
    const url = new URL(g.url, location.href);
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol === "http:") url.protocol = "ws:";
    url.searchParams.set("token", g.token);
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    ws = socket;
    socket.onopen = () => {
      if (ws !== socket) return;
      s.connected = true;
      reconnectDelay = 500;
      event("ws_open");
      for (const f of unacked) socket.send(f.bytes);
    };
    socket.onmessage = (e) => ws === socket && onRelayMessage(e.data);
    socket.onclose = (e) => {
      if (ws !== socket) return;
      ws = null;
      s.connected = false;
      event(`ws_closed_${e.code}`);
      if (e.code === CLOSE.superseded) return fail("superseded");
      if (e.code !== CLOSE.ended) scheduleReconnect();
    };
  }

  function attachMic(next: MediaStream) {
    if (!ctx || !node) return;
    stream = next;
    source = ctx.createMediaStreamSource(next);
    source.connect(node);
    s.micLive = true;
    for (const track of next.getAudioTracks()) {
      listen(track, "mute", () => {
        s.micLive = false;
        event("track_muted");
      });
      listen(track, "unmute", () => {
        s.micLive = true;
        event("track_unmuted");
      });
      listen(track, "ended", () => {
        s.micLive = false;
        event("track_ended");
      });
    }
  }

  async function holdWakeLock() {
    if (!("wakeLock" in navigator)) {
      s.wakeLock = "unsupported";
      return event("wake_lock_unsupported");
    }
    try {
      const lock = await navigator.wakeLock.request("screen");
      wakeLock = lock;
      s.wakeLock = "held";
      event("wake_lock_held");
      lock.addEventListener("release", () => {
        if (wakeLock === lock) wakeLock = null;
        s.wakeLock = "released";
        event("wake_lock_released");
      });
    } catch {
      s.wakeLock = "failed";
      event("wake_lock_failed");
    }
  }

  function releaseAudio() {
    for (const track of stream?.getTracks() ?? []) track.stop();
    source?.disconnect();
    node?.port.close();
    node?.disconnect();
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
    stream = null;
    source = null;
    node = null;
    ctx = null;
    s.micLive = false;
  }

  function teardown() {
    clearInterval(ticker);
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    releaseAudio();
    void wakeLock?.release().catch(() => {});
    wakeLock = null;
    for (const undo of cleanups.splice(0)) undo();
  }

  function fail(reason: string) {
    s.error = reason;
    s.state = "failed";
    teardown();
    ws?.close();
    ws = null;
    s.connected = false;
    emit();
  }

  async function start() {
    if (s.state !== "idle") return;
    s.state = "starting";
    emit();
    try {
      // Created inside the tap, before any await, so iOS lets it run.
      const context = new AudioContext();
      ctx = context;
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      await context.audioWorklet.addModule(workletUrl);
      node = new AudioWorkletNode(context, "pcm", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: "explicit" });
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onFrame(e.data);
      listen(node, "processorerror", () => event("processor_error"));
      node.connect(context.destination);
      attachMic(mic);
      // Safari reports "interrupted" (a call, Siri, another app taking the mic), which the DOM types don't list.
      listen(context, "statechange", () => {
        s.contextState = context.state;
        event(`context_${context.state}`);
      });
      if (context.state !== "running") await context.resume();
      s.contextState = context.state;
    } catch (e) {
      return fail(e instanceof Error ? e.name : "Error");
    }
    s.state = "recording";
    s.startedAt = now();
    event("started");
    listen(document, "visibilitychange", () => {
      if (document.visibilityState === "hidden") return event("hidden");
      event("visible");
      if (s.state === "recording") {
        void holdWakeLock();
        void ctx?.resume().catch(() => {});
      }
    });
    listen(window, "pagehide", () => event("pagehide"));
    listen(window, "pageshow", () => event("pageshow"));
    ticker = setInterval(() => checkLoss(), TICK_MS);
    void holdWakeLock();
    void connect();
  }

  // From a tap after an interruption: restart the audio context and, if the mic track ended, reopen the mic.
  async function resume() {
    if (s.state !== "recording" || !ctx || !node) return;
    try {
      if (ctx.state !== "running") await ctx.resume();
      if (!stream || stream.getAudioTracks().every((t) => t.readyState === "ended")) {
        for (const track of stream?.getTracks() ?? []) track.stop();
        source?.disconnect();
        attachMic(await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } }));
        event("mic_reopened");
      }
      if (!wakeLock) void holdWakeLock();
    } catch (e) {
      s.error = e instanceof Error ? e.name : "Error";
      event("resume_failed");
    }
  }

  async function stop() {
    if (s.state !== "recording") return;
    s.state = "stopping";
    checkLoss(true);
    teardown();
    emit();
    // Give the relay up to 5 seconds to ack what is still in flight, then say why the capture ended.
    for (const end = now() + 5_000; live() && unacked.length && now() < end; ) {
      if (!ws) void connect();
      await sleep(50);
    }
    const socket = ws;
    if (socket?.readyState === WebSocket.OPEN) {
      const closed = new Promise((r) => socket.addEventListener("close", r, { once: true }));
      socket.send(JSON.stringify({ type: "end", reason: "stopped" }));
      await Promise.race([closed, sleep(2_000)]);
    }
    // fail() may have ended the capture while it drained (superseded); that outcome stands.
    if (!live()) return;
    s.state = "stopped";
    s.stoppedAt = now();
    ws?.close();
    ws = null;
    s.connected = false;
    event("stopped");
  }

  return { start, resume, stop };
}
