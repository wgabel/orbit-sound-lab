import type { LowFrequencyOscillatorWaveform } from '../../domain/modulation';
import moduleUrl from './lfo.worklet.js?url&no-inline';

export interface LfoWorkletConfiguration {
  readonly waveform: LowFrequencyOscillatorWaveform;
  readonly frequencyHz: number;
  readonly synchronized: boolean;
  readonly phaseDegrees: number;
}

export class WebAudioLfoWorkletFactory {
  private readonly registration: Promise<void>;
  private readonly seed = Math.floor(Math.random() * 0x100000000);
  private ready = false;

  constructor(private readonly context: AudioContext) {
    this.registration = context.audioWorklet?.addModule(moduleUrl).then(() => {
      this.ready = true;
    }).catch(() => {
      // Free-running periodic LFOs remain available without audio worklets.
    }) ?? Promise.resolve();
  }

  prepare(): Promise<void> {
    return this.registration;
  }

  create(configuration: LfoWorkletConfiguration): AudioWorkletNode {
    if (!this.ready) throw new Error('Sync and Smooth Random require AudioWorklet support in this browser.');
    return new AudioWorkletNode(this.context, 'orbit-lfo', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
      parameterData: {rate: configuration.frequencyHz},
      processorOptions: {configuration, seed: this.seed}
    });
  }
}
