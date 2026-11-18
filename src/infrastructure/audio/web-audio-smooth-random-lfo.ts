import moduleUrl from './smooth-random-lfo.worklet.js?url&no-inline';

const PROCESSOR_NAME = 'smooth-random-lfo';

export class WebAudioSmoothRandomLfoFactory {
  private readonly registration: Promise<void>;
  private ready = false;

  constructor(private readonly context: AudioContext) {
    this.registration = context.audioWorklet?.addModule(moduleUrl).then(() => {
      this.ready = true;
    }).catch(() => {
      // Periodic LFOs remain available if the browser cannot load audio worklets.
    }) ?? Promise.resolve();
  }

  prepare(): Promise<void> {
    return this.registration;
  }

  create(rate: number): AudioWorkletNode {
    if (!this.ready) throw new Error('Smooth Random LFO requires AudioWorklet support in this browser.');
    return new AudioWorkletNode(this.context, PROCESSOR_NAME, {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], parameterData: {rate}
    });
  }
}
