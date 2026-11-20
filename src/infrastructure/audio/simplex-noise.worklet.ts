import { readSimplexNoise } from '@domain/simplex-noise';
import type { SimplexNoiseSettings } from '@domain/simplex-noise';

interface SimplexNoiseOptions {
  readonly processorOptions: {readonly settings: SimplexNoiseSettings; readonly originFrame: number};
}

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const sampleRate: number;
declare const currentFrame: number;
declare function registerProcessor(name: string, processor: new (options: SimplexNoiseOptions) => AudioWorkletProcessor): void;

class SimplexNoiseProcessor extends AudioWorkletProcessor {
  private running = true;

  constructor(private readonly options: SimplexNoiseOptions) {
    super();
    this.port.onmessage = ({data}: MessageEvent<unknown>) => {
      if (data === 'stop') this.running = false;
    };
  }

  process(_inputs: unknown, outputs: Float32Array[][]): boolean {
    if (!this.running) return false;
    const channel = outputs[0]?.[0];
    if (!channel) return true;
    const {settings,originFrame} = this.options.processorOptions;
    const elapsedFrames = currentFrame - originFrame;
    for (let index = 0; index < channel.length; index++) {
      channel[index] = readSimplexNoise(settings,(elapsedFrames + index) / sampleRate);
    }
    return true;
  }
}

registerProcessor('orbit-simplex-noise',SimplexNoiseProcessor);
