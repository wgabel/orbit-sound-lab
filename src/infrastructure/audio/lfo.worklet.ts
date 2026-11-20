import { readPeriodicLfoSample } from '@domain/lfo-waveforms';
import type { LfoWorkletConfiguration } from './web-audio-lfo-worklet';

interface LfoProcessorOptions {
  readonly processorOptions: {readonly configuration: LfoWorkletConfiguration; readonly seed: number};
}

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const sampleRate: number;
declare const currentFrame: number;
declare function registerProcessor(name: string, processor: new (options: LfoProcessorOptions) => AudioWorkletProcessor): void;

function smoothstep(phase: number) {
  return phase * phase * (3 - 2 * phase);
}

function randomLevelAtCycle(cycle: number, seed: number) {
  let value = (cycle + seed) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x80000000 - 1;
}

class LfoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{name: 'rate', defaultValue: 0.2, minValue: 0.01, maxValue: 20, automationRate: 'k-rate'}];
  }

  private configuration: LfoWorkletConfiguration;
  private readonly seed: number;
  private phase = 0;
  private previous = 0;
  private target = this.randomTarget();
  private randomCycle: number | null = null;
  private synchronizedPrevious = 0;
  private synchronizedTarget = 0;
  private running = true;
  private lastSample: number | null = null;
  private readonly transitionLength = Math.max(1, Math.round(sampleRate * 0.02));
  private transitionRemaining = 0;
  private transitionFrom = 0;

  constructor({processorOptions}: LfoProcessorOptions) {
    super();
    this.configuration = processorOptions.configuration;
    this.seed = processorOptions.seed;
    this.port.onmessage = ({data}: MessageEvent<LfoWorkletConfiguration | 'stop'>) => {
      if (data === 'stop') {
        this.running = false;
        return;
      }
      const current = this.configuration;
      if (data.waveform === current.waveform && data.synchronized === current.synchronized &&
          data.phaseDegrees === current.phaseDegrees && data.phaseOriginFrame === current.phaseOriginFrame && (!data.synchronized || data.frequencyHz === current.frequencyHz)) return;
      this.configuration = data;
      if (this.lastSample !== null) {
        this.transitionFrom = this.lastSample;
        this.transitionRemaining = this.transitionLength;
      }
    };
  }

  randomTarget() {
    return Math.random() * 2 - 1;
  }

  synchronizedSample(frame: number, configuration: LfoWorkletConfiguration) {
    // All nodes in this context calculate phase from the same audio render frame.
    const cycles = ((frame - (configuration.phaseOriginFrame ?? 0)) / sampleRate) * configuration.frequencyHz + configuration.phaseDegrees / 360;
    const cycle = Math.floor(cycles);
    const phase = cycles - cycle;
    if (configuration.waveform !== 'smoothRandom') return readPeriodicLfoSample(configuration.waveform,phase);
    if (this.randomCycle !== cycle) {
      this.randomCycle = cycle;
      this.synchronizedPrevious = randomLevelAtCycle(cycle,this.seed);
      this.synchronizedTarget = randomLevelAtCycle(cycle + 1,this.seed);
    }
    return this.synchronizedPrevious + (this.synchronizedTarget - this.synchronizedPrevious) * smoothstep(phase);
  }

  freePeriodicSample(waveform: Exclude<LfoWorkletConfiguration['waveform'],'smoothRandom'>, increment: number): number {
    const sample = readPeriodicLfoSample(waveform,this.phase);
    this.phase = (this.phase + increment) % 1;
    return sample;
  }

  freeRandomSample(increment: number) {
    const sample = this.previous + (this.target - this.previous) * smoothstep(this.phase);
    this.phase += increment;
    if (this.phase >= 1) {
      this.phase -= 1;
      this.previous = this.target;
      this.target = this.randomTarget();
    }
    return sample;
  }

  process(_inputs: unknown, outputs: Float32Array[][], parameters: {rate: Float32Array}) {
    if (!this.running) return false;
    const output = outputs[0]?.[0];
    if (!output) return true;
    const configuration = this.configuration;
    const increment = parameters.rate[0] / sampleRate;
    for (let index = 0; index < output.length; index++) {
      const sample = configuration.synchronized
        ? this.synchronizedSample(currentFrame + index, configuration)
        : configuration.waveform === 'smoothRandom'
          ? this.freeRandomSample(increment) : this.freePeriodicSample(configuration.waveform,increment);
      if (this.transitionRemaining > 0) {
        const mix = 1 - this.transitionRemaining-- / this.transitionLength;
        output[index] = this.transitionFrom + (sample - this.transitionFrom) * mix;
      } else {
        output[index] = sample;
      }
      this.lastSample = output[index];
    }
    return true;
  }
}

registerProcessor('orbit-lfo', LfoProcessor);
