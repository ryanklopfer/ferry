import { createFramer } from "@/core/capture/pcm";

// Runs on the audio rendering thread; `bun run build:sw` bundles it to public/worklets/pcm.js. It posts one
// 100 ms frame of 16 kHz s16le PCM at a time and never keeps audio beyond the frame being filled.
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor & { process(inputs: Float32Array[][]): boolean }): void;

class PcmProcessor extends AudioWorkletProcessor {
  private readonly push = createFramer(sampleRate);

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (channel) for (const frame of this.push(channel)) this.port.postMessage(frame.buffer, [frame.buffer]);
    return true;
  }
}

registerProcessor("pcm", PcmProcessor);
