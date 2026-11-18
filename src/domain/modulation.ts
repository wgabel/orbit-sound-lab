export const LFO_MINIMUM_RATE_HZ = 0.01;
export const LFO_MAXIMUM_RATE_HZ = 20;
export const AMPLITUDE_LFO_CENTER = 0.5;

export type LowFrequencyOscillatorWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';
export type LowFrequencyOscillatorDestination = 'pitch' | 'filterCutoff' | 'amplitude';
export interface LowFrequencyOscillatorSettings {
  readonly destination: LowFrequencyOscillatorDestination;
  readonly depthHz: number;
  readonly depthAmplitude: number;
  readonly enabled: boolean;
  readonly frequencyHz: number;
  readonly depthCents: number;
  readonly waveform: LowFrequencyOscillatorWaveform;
  readonly targetOscillatorId: string;
}
export function createDefaultLowFrequencyOscillatorSettings(targetOscillatorId = 'oscillator-1'): LowFrequencyOscillatorSettings {
  return { enabled: false, frequencyHz: 0.2, depthCents: 15, depthHz: 400, depthAmplitude: 0.35, destination: 'pitch', waveform: 'sine', targetOscillatorId };
}
export function createDefaultLowFrequencyOscillators(oscillatorIds: readonly string[]): readonly LowFrequencyOscillatorSettings[] {
  return oscillatorIds.flatMap(id => (['pitch', 'filterCutoff', 'amplitude'] as const).map(destination => ({...createDefaultLowFrequencyOscillatorSettings(id), destination})));
}
export function validateLowFrequencyOscillatorSettings(settings: LowFrequencyOscillatorSettings): void {
  if (!Number.isFinite(settings.frequencyHz) || settings.frequencyHz < LFO_MINIMUM_RATE_HZ || settings.frequencyHz > LFO_MAXIMUM_RATE_HZ) throw new Error('LFO frequency must be between 0.01 and 20 Hz.');
  if (!Number.isFinite(settings.depthCents) || settings.depthCents < 0 || settings.depthCents > 1200) throw new Error('LFO depth must be between 0 and 1200 cents.');
  if (!Number.isFinite(settings.depthHz) || settings.depthHz < 0 || settings.depthHz > 10000) throw new Error('Filter modulation depth must be between 0 and 10000 Hz.');
  if (!Number.isFinite(settings.depthAmplitude) || settings.depthAmplitude < 0 || settings.depthAmplitude > AMPLITUDE_LFO_CENTER) throw new Error('Amplitude depth must be between 0 and 0.5.');
  if (settings.destination !== 'pitch' && settings.destination !== 'filterCutoff' && settings.destination !== 'amplitude') throw new Error('Invalid LFO destination.');
  if (!['sine', 'triangle', 'square', 'sawtooth'].includes(settings.waveform)) throw new Error('Invalid LFO waveform.');
  if (!settings.targetOscillatorId) throw new Error('LFO target is required.');
}

export function getFilterModulationLimits(cutoffHz: number, sampleRate: number) {
  return {minimum: Math.max(20, cutoffHz * 0.12), maximum: Math.min(20000, sampleRate / 2)};
}

/** Keep a symmetric cutoff sweep away from DC and below the filter's upper limit. */
export function limitFilterModulationDepth(depthHz: number, cutoffHz: number, sampleRate: number): number {
  const {minimum, maximum} = getFilterModulationLimits(cutoffHz, sampleRate);
  return Math.max(0, Math.min(depthHz, cutoffHz - minimum, maximum - cutoffHz));
}

export function applyPitchOffset(frequencyHz: number, cents: number): number {
  return frequencyHz * 2 ** (cents / 1200);
}
