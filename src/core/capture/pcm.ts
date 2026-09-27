// What HealthScribe and Transcribe Medical streaming take: 16 kHz mono signed 16-bit little-endian PCM.
export const SAMPLE_RATE = 16_000;
export const FRAME_MS = 100;
export const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000;
export const BYTES_PER_SAMPLE = 2;
export const FRAME_BYTES = FRAME_SAMPLES * BYTES_PER_SAMPLE;
export const BYTES_PER_MS = (SAMPLE_RATE / 1000) * BYTES_PER_SAMPLE;

export const msForBytes = (bytes: number) => bytes / BYTES_PER_MS;

// Takes exactly one 100 ms frame so the output is always 1,600 samples: resampling arbitrary chunk
// lengths without carried state would round every chunk and drift the audio clock.
export function downsampleToS16(frame: Float32Array, inRate: number): Int16Array {
  if (!Number.isInteger(inRate) || inRate < SAMPLE_RATE) throw new RangeError(`inRate must be an integer of at least ${SAMPLE_RATE}`);
  const expected = (inRate * FRAME_MS) / 1000;
  if (frame.length !== expected) throw new RangeError(`expected one ${FRAME_MS} ms frame of ${expected} samples, got ${frame.length}`);
  const ratio = inRate / SAMPLE_RATE;
  const out = new Int16Array(FRAME_SAMPLES);
  for (let i = 0; i < FRAME_SAMPLES; i++) {
    // Averaging each output sample's input window is a cheap low-pass against aliasing.
    const from = Math.floor(i * ratio);
    const to = Math.max(from + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to; j++) sum += frame[j] || 0;
    const v = Math.round((sum / (to - from)) * 32_767);
    out[i] = v > 32_767 ? 32_767 : v < -32_768 ? -32_768 : v;
  }
  return out;
}

export function toS16le(samples: Int16Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * BYTES_PER_SAMPLE);
  const view = new DataView(bytes.buffer);
  samples.forEach((v, i) => view.setInt16(i * BYTES_PER_SAMPLE, v, true));
  return bytes;
}
