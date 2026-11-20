import type { PatchModule } from '@domain/patch';
import type { WebAudioLfoWorkletFactory } from '@infrastructure/audio/web-audio-lfo-worklet';
import type { WebAudioLowFrequencyOscillatorFactory } from '@infrastructure/audio/web-audio-low-frequency-oscillator';
import type { WebAudioPulseWorkletFactory } from '@infrastructure/audio/web-audio-pulse-worklet';
import type { WebAudioSimplexNoiseFactory } from '@infrastructure/audio/web-audio-simplex-noise';
import type { PatchRuntimeModule, PatchRuntimeOptions } from './contracts';
import { createAutomationRuntime, createChordProgressionRuntime, createChordRuntime,
  createDroneRuntime, createLfoRuntime, createSimplexNoiseRuntime,
  createWaveRuntime } from './source-modules';
import { createFilterRuntime, createOscilloscopeRuntime, createPitchShiftRuntime,
  createReverbRuntime, createShelfEqRuntime } from './processor-modules';
import { createCrossfaderRuntime, createLevelRuntime, createMixerRuntime } from './routing-modules';

export type { PatchParameterBinding, PatchRuntimeModule, PatchRuntimeEnvironment,
  PatchRuntimeFactory, PatchRuntimeOptions } from './contracts';

/** Exhaustive dispatch from a serializable module definition to its Web Audio owner. */
export function createPatchRuntimeModule(
  context: AudioContext,
  definition: PatchModule,
  pulse: WebAudioPulseWorkletFactory,
  modulationFactory: WebAudioLowFrequencyOscillatorFactory,
  lfo: WebAudioLfoWorkletFactory,
  simplexNoise: WebAudioSimplexNoiseFactory,
  master: AudioNode,
  origin: number,
  options: PatchRuntimeOptions = {}
): PatchRuntimeModule {
  const environment = {context,pulse,modulationFactory,lfo,simplexNoise,master,origin,options};
  switch (definition.kind) {
    case 'automation': return createAutomationRuntime(definition,environment);
    case 'chord': return createChordRuntime(definition,environment);
    case 'chordProgression': return createChordProgressionRuntime(definition,environment);
    case 'crossfader': return createCrossfaderRuntime(definition,environment);
    case 'drone': return createDroneRuntime(definition,environment);
    case 'filter': return createFilterRuntime(definition,environment);
    case 'gain':
    case 'output': return createLevelRuntime(definition,environment);
    case 'lfo': return createLfoRuntime(definition,environment);
    case 'mixer': return createMixerRuntime(definition,environment);
    case 'oscilloscope': return createOscilloscopeRuntime(definition,environment);
    case 'pitchShift': return createPitchShiftRuntime(definition,environment);
    case 'reverb': return createReverbRuntime(definition,environment);
    case 'shelfEq': return createShelfEqRuntime(definition,environment);
    case 'simplexNoise': return createSimplexNoiseRuntime(definition,environment);
    case 'wave': return createWaveRuntime(definition,environment);
  }
}
