import type { PatchModule, PatchModuleKind, PatchModuleOf } from '@domain/patch';
import type { AutomationPlaybackTiming } from '@domain/patch/automation';
import type { ArrangementClip } from '@domain/patch/arrangement';
import type { ChordRoute } from '@infrastructure/audio/patch/chords';
import type { AutomationTimingRoute } from '@infrastructure/audio/web-audio-automation-timing';
import type { WebAudioLfoWorkletFactory } from '@infrastructure/audio/web-audio-lfo-worklet';
import type { WebAudioLowFrequencyOscillatorFactory } from '@infrastructure/audio/web-audio-low-frequency-oscillator';
import type { WebAudioPitchShiftWorkletFactory } from '@infrastructure/audio/web-audio-pitch-shift-worklet';
import type { WebAudioPulseWorkletFactory } from '@infrastructure/audio/web-audio-pulse-worklet';
import type { WebAudioSimplexNoiseFactory } from '@infrastructure/audio/web-audio-simplex-noise';

export interface PatchParameterBinding {
  readonly parameter: AudioParam;
  readonly base: number;
  readonly constrain?: (value: number) => number;
}

/** Web Audio resources owned by one running patch module. */
export interface PatchRuntimeModule {
  readonly definition: PatchModule;
  readonly inputs?: Readonly<Partial<Record<string,AudioNode>>>;
  readonly output?: AudioNode;
  readonly parameters?: Readonly<Record<string,PatchParameterBinding>>;
  readonly waveformAnalyser?: AnalyserNode;
  readonly chordProgression?: ChordRoute['settings'];
  readLfoPhase?(elapsed: number): number;
  readControlValue?(): number;
  readAutomationTiming?(elapsed: number): AutomationPlaybackTiming | undefined;
  dispose(): void;
}

export interface PatchRuntimeOptions {
  readonly clips?: readonly ArrangementClip[];
  readonly chordRoute?: ChordRoute;
  readonly pitchWorklet?: WebAudioPitchShiftWorkletFactory;
  readonly automationTiming?: AutomationTimingRoute;
}

/** Dependencies passed to focused module factories by the patch composition root. */
export interface PatchRuntimeEnvironment {
  readonly context: AudioContext;
  readonly pulse: WebAudioPulseWorkletFactory;
  readonly modulationFactory: WebAudioLowFrequencyOscillatorFactory;
  readonly lfo: WebAudioLfoWorkletFactory;
  readonly simplexNoise: WebAudioSimplexNoiseFactory;
  readonly master: AudioNode;
  readonly origin: number;
  readonly options: PatchRuntimeOptions;
}

export type PatchRuntimeFactory<Kind extends PatchModuleKind> = (
  definition: PatchModuleOf<Kind>,
  environment: PatchRuntimeEnvironment
) => PatchRuntimeModule;
