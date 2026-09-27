// A mono 16-bit PCM WAV, the format Chromium's --use-file-for-fake-audio-capture reads.
export function wav(samples: Int16Array, sampleRate: number): Uint8Array {
  const data = samples.length * 2;
  const out = new Uint8Array(44 + data);
  const v = new DataView(out.buffer);
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  v.setUint32(4, 36 + data, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, data, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, s, true));
  return out;
}

export function tone({ seconds, hz, sampleRate, amplitude = 0.3 }: { seconds: number; hz: number; sampleRate: number; amplitude?: number }): Int16Array {
  return Int16Array.from({ length: seconds * sampleRate }, (_, i) => Math.round(amplitude * 32_767 * Math.sin((2 * Math.PI * hz * i) / sampleRate)));
}
