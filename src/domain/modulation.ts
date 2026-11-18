export type LowFrequencyOscillatorWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';
export interface LowFrequencyOscillatorSettings {
  readonly enabled: boolean;
  readonly frequencyHz: number;
  readonly depthCents: number;
  readonly waveform: LowFrequencyOscillatorWaveform;
  readonly targetOscillatorId: string;
}
export function createDefaultLowFrequencyOscillatorSettings(targetOscillatorId = 'oscillator-1'): LowFrequencyOscillatorSettings {
  return { enabled: false, frequencyHz: 0.2, depthCents: 15, waveform: 'sine', targetOscillatorId };
}
export function createDefaultLowFrequencyOscillators(oscillatorIds: readonly string[]): readonly LowFrequencyOscillatorSettings[] {
  return oscillatorIds.map(createDefaultLowFrequencyOscillatorSettings);
}
export function validateLowFrequencyOscillatorSettings(settings: LowFrequencyOscillatorSettings): void {
  if (!Number.isFinite(settings.frequencyHz) || settings.frequencyHz < 0.01 || settings.frequencyHz > 20) throw new Error('LFO frequency must be between 0.01 and 20 Hz.');
  if (!Number.isFinite(settings.depthCents) || settings.depthCents < 0 || settings.depthCents > 1200) throw new Error('LFO depth must be between 0 and 1200 cents.');
  if (!['sine', 'triangle', 'square', 'sawtooth'].includes(settings.waveform)) throw new Error('Invalid LFO waveform.');
  if (!settings.targetOscillatorId) throw new Error('LFO target is required.');
}
