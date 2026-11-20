import type { SimplexNoiseSettings } from '@domain/simplex-noise';
import { createControlMonitor } from './web-audio-control-monitor';
import moduleUrl from './simplex-noise.worklet.ts?worker&url';

export class WebAudioSimplexNoiseFactory {
  private readonly registration: Promise<void>;
  private ready = false;

  constructor(private readonly context: AudioContext) {
    this.registration = context.audioWorklet?.addModule(moduleUrl).then(() => {
      this.ready = true;
    }).catch(() => {
      // Patches that do not use Simplex Noise can still play.
    }) ?? Promise.resolve();
  }

  prepare(): Promise<void> {
    return this.registration;
  }

  create(settings: SimplexNoiseSettings, origin: number) {
    if (!this.ready) throw new Error('Simplex Noise requires AudioWorklet support.');
    const output = new AudioWorkletNode(this.context,'orbit-simplex-noise',{
      numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1],
      processorOptions:{settings,originFrame:Math.round(origin * this.context.sampleRate)}
    });
    const monitor = createControlMonitor(this.context,output);
    return {
      output,
      readControlValue:monitor.read,
      dispose() {
        output.port.postMessage('stop');
        output.port.close();
        output.disconnect();
      }
    };
  }
}
