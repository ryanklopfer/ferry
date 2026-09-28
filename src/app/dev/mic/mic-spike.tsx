"use client";

import { useEffect, useRef, useState } from "react";
import { createRecorder, type Recorder, type RecorderSnapshot } from "@/ui/capture/recorder";
import { Button } from "@/ui/button";
import { Notice } from "@/ui/notice";

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
      onChange: (next) => recorder.current === r && setSnapshot(next),
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
  const lastAudioAt = s?.lastFrameAt ?? s?.startedAt;
  const stalledMs = recording && lastAudioAt && now > lastAudioAt ? now - lastAudioAt : 0;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="font-display text-h1">Mic spike (dev only)</h1>
        <p className="text-secondary text-slate">Synthetic speech only. Record, then lock the screen, take a call or switch apps, and come back. Every stop in the audio must show below as a gap.</p>
      </div>

      <div className="flex gap-2">
        {state === "idle" || state === "stopped" || state === "failed" ? (
          <Button variant="primary" onClick={start}>
            Start recording
          </Button>
        ) : null}
        {recording ? (
          <>
            <Button variant="primary" onClick={() => void recorder.current?.stop()}>
              Stop
            </Button>
            <Button variant="secondary" onClick={() => void recorder.current?.resume()}>
              Resume mic
            </Button>
          </>
        ) : null}
      </div>

      {stalledMs > 1_500 ? <Notice>No audio for {seconds(stalledMs)}. Tap Resume mic.</Notice> : null}
      {s?.error ? <p className="text-secondary text-danger">Failed: {s.error}</p> : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-card bg-white p-5.5 text-secondary">
        <dt>State</dt>
        <dd data-testid="state">{state}</dd>
        <dt>Capture</dt>
        <dd className="truncate text-caption tabular-nums">{captureId ?? "none"}</dd>
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
        <h2 className="text-label">Gaps</h2>
        {s?.gaps.length ? (
          <ul className="text-secondary" data-testid="gaps">
            {s.gaps.map((g) => (
              <li key={g.from}>
                {clock(g.from)}: {seconds(g.durationMs)} ({g.cause})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-secondary text-slate" data-testid="gaps">
            None.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-label">Events</h2>
        <ol className="max-h-64 overflow-y-auto text-caption tabular-nums">
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

      <a className="text-secondary underline" href={`/dev/file-input?k=${encodeURIComponent(k)}`}>
        Android file-input check
      </a>
    </div>
  );
}
