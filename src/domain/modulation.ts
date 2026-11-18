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
  return oscillatorIds.map(createDefaultLowFrequencyOscillatorSettings);
}
export function validateLowFrequencyOscillatorSettings(settings: LowFrequencyOscillatorSettings): void {
  if (!Number.isFinite(settings.frequencyHz) || settings.frequencyHz < 0.01 || settings.frequencyHz > 20) throw new Error('LFO frequency must be between 0.01 and 20 Hz.');
  if (!Number.isFinite(settings.depthCents) || settings.depthCents < 0 || settings.depthCents > 1200) throw new Error('LFO depth must be between 0 and 1200 cents.');
  if (!Number.isFinite(settings.depthHz) || settings.depthHz < 0 || settings.depthHz > 10000) throw new Error('Filter modulation depth must be between 0 and 10000 Hz.');
  if (!Number.isFinite(settings.depthAmplitude) || settings.depthAmplitude < 0 || settings.depthAmplitude > 0.5) throw new Error('Amplitude depth must be between 0 and 0.5.');
  if (settings.destination !== 'pitch' && settings.destination !== 'filterCutoff' && settings.destination !== 'amplitude') throw new Error('Invalid LFO destination.');
  if (!['sine', 'triangle', 'square', 'sawtooth'].includes(settings.waveform)) throw new Error('Invalid LFO waveform.');
  if (!settings.targetOscillatorId) throw new Error('LFO target is required.');
}
