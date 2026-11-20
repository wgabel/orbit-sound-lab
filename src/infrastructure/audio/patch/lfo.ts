import { readPatchLfoPhase } from '@domain/patch/lfo';
import { createControlMonitor } from '@infrastructure/audio/web-audio-control-monitor';
import type { PatchLfo } from '@domain/patch/lfo';
import type { WebAudioLfoWorkletFactory } from '@infrastructure/audio/web-audio-lfo-worklet';

export function createPatchLfoSignal(context: AudioContext, factory: WebAudioLfoWorkletFactory,
  settings: PatchLfo, transportOrigin: number) {
  const originFrame = Math.round((settings.sync ? transportOrigin : context.currentTime) * context.sampleRate);
  const elapsedOffset = originFrame / context.sampleRate - transportOrigin;
  const source = factory.create({
    waveform:settings.waveform, frequencyHz:settings.rateHz, synchronized:true,
    phaseDegrees:settings.sync ? settings.phaseDegrees % 360 : 0, phaseOriginFrame:originFrame
  },{independentSeed:!settings.sync});
  const smoothing = context.createBiquadFilter();
  smoothing.type = 'lowpass';
  smoothing.frequency.value = 80;
  smoothing.Q.value = 20 * Math.log10(0.5);
  const output = context.createWaveShaper();
  output.curve = new Float32Array([0,0.5,1]);
  source.connect(smoothing).connect(output);
  const monitor = createControlMonitor(context,output);

  return {
    output,
    readValue:monitor.read,
    readPhase:(elapsed: number) => readPatchLfoPhase(settings,elapsed - elapsedOffset),
    dispose() {
      source.port.postMessage('stop');
      source.port.close();
      source.disconnect();
      smoothing.disconnect();
      output.disconnect();
    }
  };
}
