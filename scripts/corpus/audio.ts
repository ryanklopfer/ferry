import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tone, wav } from "./wav";

// `bun run corpus:audio`: the synthetic audio for the mic spike and, later, the scribe checks. The tone feeds
// Chromium's fake mic in e2e/mic-spike.spec.ts; the speech is macOS `say` reading invented lines, for playing
// at a phone during the Gate A run. No real voice or session is ever used.
const OUT = path.join(process.cwd(), "corpus", "synthetic", "audio");
const SPEECH =
  "This is a synthetic test recording for the Ferry capture spike. Nothing here is about a real person. " +
  "One, two, three, four, five. The quick brown fox jumps over the lazy dog. " +
  "We are checking that the microphone keeps working when the screen locks, when a call comes in, and when you switch apps.";

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "tone-10s.wav"), wav(tone({ seconds: 10, hz: 440, sampleRate: 16_000 }), 16_000));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ferry-say-"));
try {
  const aiff = path.join(tmp, "speech.aiff");
  const run = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${cmd} failed (macOS only): ${r.stderr || r.error?.message}`);
  };
  run("say", ["-o", aiff, SPEECH]);
  run("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", aiff, path.join(OUT, "speech-synthetic.wav")]);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log("corpus:audio wrote corpus/synthetic/audio/tone-10s.wav and speech-synthetic.wav");
