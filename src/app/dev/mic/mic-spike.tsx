"use client";

import { useEffect, useRef, useState } from "react";
import { createRecorder, type Recorder, type RecorderSnapshot } from "@/ui/capture/recorder";

const newCaptureId = () => `cap_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour12: false });

// Gate A instrument. Everything shown here is counts and timings; the audio goes only to the relay, which counts it.
export function MicSpike({ k }: { k: string }) {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot | null>(null);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const recorder = useRef<Recorder | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  function start() {
    const id = newCaptureId();
    const r = createRecorder({
      captureId: id,
      onChange: setSnapshot,
      grant: async () => {
        const res = await fetch("/api/dev/relay-token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ k, captureId: id }) });
        if (!res.ok) throw new Error(`relay token ${res.status}`);
        return res.json();
      },
    });
    recorder.current = r;
    setCaptureId(id);
    void r.start();
  }

  const s = snapshot;
  const state = s?.state ?? "idle";
  const recording = state === "recording";
  const wallMs = s?.startedAt ? (s.stoppedAt ?? now) - s.startedAt : 0;
  const stalledMs = recording && s?.lastFrameAt && now > s.lastFrameAt ? now - s.lastFrameAt : 0;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Mic spike (dev only)</h1>
        <p className="text-sm text-stone-600">Synthetic speech only. Record, then lock the screen, take a call or switch apps, and come back. Every stop in the audio must show below as a gap.</p>
      </div>

      <div className="flex gap-2">
        {state === "idle" || state === "stopped" || state === "failed" ? (
          <button className="btn-primary" onClick={start}>
            Start recording
          </button>
        ) : null}
        {recording ? (
          <>
            <button className="btn-primary" onClick={() => void recorder.current?.stop()}>
              Stop
            </button>
            <button className="btn-secondary" onClick={() => void recorder.current?.resume()}>
              Resume mic
            </button>
          </>
        ) : null}
      </div>

      {stalledMs > 1_500 ? <p className="rounded-md bg-amber-100 p-2 text-sm font-medium text-amber-900">No audio for {seconds(stalledMs)}. Tap Resume mic.</p> : null}
      {s?.error ? <p className="rounded-md bg-red-100 p-2 text-sm text-red-800">Failed: {s.error}</p> : null}

      <dl className="card grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt>State</dt>
        <dd data-testid="state">{state}</dd>
        <dt>Capture</dt>
        <dd className="truncate font-mono text-xs">{captureId ?? "none"}</dd>
        <dt>Wall time</dt>
        <dd>{seconds(wallMs)}</dd>
        <dt>Audio produced</dt>
        <dd data-testid="produced-ms">{s?.producedMs ?? 0}</dd>
        <dt>Relay counted (ms)</dt>
        <dd data-testid="relay-ms">{s?.relayMs ?? 0}</dd>
        <dt>Gaps total</dt>
        <dd>{seconds(s?.gaps.reduce((n, g) => n + g.durationMs, 0) ?? 0)}</dd>
        <dt>Dropped</dt>
        <dd>{seconds(s?.droppedMs ?? 0)}</dd>
        <dt>Unacked frames</dt>
        <dd>{s?.unackedFrames ?? 0}</dd>
        <dt>Relay connected</dt>
        <dd>{s?.connected ? "yes" : "no"}</dd>
        <dt>Mic live</dt>
        <dd>{s?.micLive ? "yes" : "no"}</dd>
        <dt>Audio context</dt>
        <dd>{s?.contextState ?? "none"}</dd>
        <dt>Wake lock</dt>
        <dd>{s?.wakeLock ?? "none"}</dd>
      </dl>

      <section>
        <h2 className="text-sm font-semibold">Gaps</h2>
        {s?.gaps.length ? (
          <ul className="text-sm" data-testid="gaps">
            {s.gaps.map((g) => (
              <li key={g.from}>
                {clock(g.from)}: {seconds(g.durationMs)} ({g.cause})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500" data-testid="gaps">
            None.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold">Events</h2>
        <ol className="max-h-64 overflow-y-auto font-mono text-xs">
          {s?.events
            .slice()
            .reverse()
            .map((e, i) => (
              <li key={`${e.at}-${i}`}>
                {clock(e.at)} {e.kind}
              </li>
            ))}
        </ol>
      </section>

      <a className="text-sm underline" href={`/dev/file-input?k=${encodeURIComponent(k)}`}>
        Android file-input check
      </a>
    </div>
  );
}
