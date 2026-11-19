import { MAXIMUM_PULSE_WIDTH, MINIMUM_PULSE_WIDTH } from '../../domain/drone';
import moduleUrl from './pulse.worklet.js?url&no-inline';

export class WebAudioPulseWorkletFactory {
  private readonly registration: Promise<void>;
  private ready = false;

  constructor(private readonly context: AudioContext) {
    this.registration = context.audioWorklet?.addModule(moduleUrl).then(() => {
      this.ready = true;
    }).catch(() => {
      // The native waveforms are still available if registration fails.
    }) ?? Promise.resolve();
  }

  prepare(): Promise<void> {
    return this.registration;
  }

  assertAvailable(): void {
    if (!this.ready) throw new Error('Variable Pulse requires AudioWorklet support in this browser.');
  }

  create(): AudioWorkletNode {
    this.assertAvailable();
    return new AudioWorkletNode(this.context, 'orbit-pulse', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
      processorOptions: {minimumWidth: MINIMUM_PULSE_WIDTH, maximumWidth: MAXIMUM_PULSE_WIDTH}
    });
  }
}
