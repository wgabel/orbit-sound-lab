import { readPatchLfoPhase } from '../../domain/patch-lfo';
import type { PatchLfo, PatchLfoReading } from '../../domain/patch-lfo';
import type { WebAudioLfoWorkletFactory } from './web-audio-lfo-worklet';

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
  const analyser = settings.waveform === 'smoothRandom' ? context.createAnalyser() : undefined;
  const samples = analyser ? new Float32Array(32) : undefined;
  if (analyser) {
    analyser.fftSize = 32;
    output.connect(analyser);
  }

  return {
    output,
    read(elapsed: number): PatchLfoReading {
      if (analyser && samples) analyser.getFloatTimeDomainData(samples);
      return {phase:readPatchLfoPhase(settings,elapsed - elapsedOffset), sample:samples?.at(-1)};
    },
    dispose() {
      source.port.postMessage('stop');
      source.port.close();
      source.disconnect();
      smoothing.disconnect();
      output.disconnect();
      analyser?.disconnect();
    }
  };
}
