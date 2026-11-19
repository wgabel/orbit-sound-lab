import { OSCILLATOR_WAVEFORMS } from './oscillator-waveforms';

export const LFO_MINIMUM_RATE_HZ = 0.01;
export const LFO_MAXIMUM_RATE_HZ = 20;
export const AMPLITUDE_LFO_CENTER = 0.5;

export const LOW_FREQUENCY_OSCILLATOR_WAVEFORMS = [...OSCILLATOR_WAVEFORMS, 'smoothRandom'] as const;
export type LowFrequencyOscillatorWaveform = typeof LOW_FREQUENCY_OSCILLATOR_WAVEFORMS[number];
export const LFO_DESTINATIONS = ['pitch', 'filterCutoff', 'amplitude', 'shape'] as const;
export type LowFrequencyOscillatorDestination = typeof LFO_DESTINATIONS[number];
export const DEFAULT_SHAPE_LFO_DEPTH = 0.2;
export interface LowFrequencyOscillatorSettings {
  readonly destination: LowFrequencyOscillatorDestination;
  readonly depthHz: number;
  readonly depthAmplitude: number;
  readonly depthShape?: number;
  readonly enabled: boolean;
  readonly frequencyHz: number;
  readonly depthCents: number;
  readonly waveform: LowFrequencyOscillatorWaveform;
  readonly sync?: boolean;
  readonly phaseDegrees?: number;
  readonly targetOscillatorId: string;
}
export function createDefaultLowFrequencyOscillatorSettings(targetOscillatorId = 'oscillator-1'): LowFrequencyOscillatorSettings {
  return { enabled: false, frequencyHz: 0.2, depthCents: 15, depthHz: 400, depthAmplitude: 0.35, destination: 'pitch', waveform: 'sine', targetOscillatorId };
}
export function createDefaultLowFrequencyOscillators(oscillatorIds: readonly string[]): readonly LowFrequencyOscillatorSettings[] {
  return oscillatorIds.flatMap(id => LFO_DESTINATIONS.map(destination =>
    ({...createDefaultLowFrequencyOscillatorSettings(id), destination,
      ...(destination === 'shape' ? {depthShape: DEFAULT_SHAPE_LFO_DEPTH} : {})})));
}
export function validateLowFrequencyOscillatorSettings(settings: LowFrequencyOscillatorSettings): void {
  if (!Number.isFinite(settings.frequencyHz) || settings.frequencyHz < LFO_MINIMUM_RATE_HZ || settings.frequencyHz > LFO_MAXIMUM_RATE_HZ) throw new Error('LFO frequency must be between 0.01 and 20 Hz.');
  if (!Number.isFinite(settings.depthCents) || settings.depthCents < 0 || settings.depthCents > 1200) throw new Error('LFO depth must be between 0 and 1200 cents.');
  if (!Number.isFinite(settings.depthHz) || settings.depthHz < 0 || settings.depthHz > 10000) throw new Error('Filter modulation depth must be between 0 and 10000 Hz.');
  if (!Number.isFinite(settings.depthAmplitude) || settings.depthAmplitude < 0 || settings.depthAmplitude > AMPLITUDE_LFO_CENTER) throw new Error('Amplitude depth must be between 0 and 0.5.');
  if (settings.depthShape !== undefined && (!Number.isFinite(settings.depthShape) || settings.depthShape < 0 || settings.depthShape > 1)) {
    throw new Error('Shape depth must be between 0 and 1.');
  }
  if (!LFO_DESTINATIONS.includes(settings.destination)) throw new Error('Invalid LFO destination.');
  if (!LOW_FREQUENCY_OSCILLATOR_WAVEFORMS.includes(settings.waveform)) throw new Error('Invalid LFO waveform.');
  if (settings.sync !== undefined && typeof settings.sync !== 'boolean') throw new Error('Invalid LFO sync setting.');
  if (settings.phaseDegrees !== undefined &&
    (!Number.isFinite(settings.phaseDegrees) || settings.phaseDegrees < 0 || settings.phaseDegrees > 360)) {
    throw new Error('LFO phase must be between 0 and 360 degrees.');
  }
  if (!settings.targetOscillatorId) throw new Error('LFO target is required.');
}

export function validateLowFrequencyOscillatorBank(settings: readonly LowFrequencyOscillatorSettings[],
  oscillatorIds: readonly string[]): void {
  const ids = new Set(oscillatorIds);
  const targets = new Set<string>();
  if (settings.length !== ids.size * LFO_DESTINATIONS.length) {
    throw new Error('Each oscillator requires one LFO configuration per destination.');
  }
  for (const item of settings) {
    validateLowFrequencyOscillatorSettings(item);
    const key = `${item.targetOscillatorId}:${item.destination}`;
    if (!ids.has(item.targetOscillatorId) || targets.has(key)) {
      throw new Error('LFO targets must be unique and match oscillator identifiers.');
    }
    targets.add(key);
  }
}

export function getFilterModulationLimits(cutoffHz: number, sampleRate: number) {
  return {minimum: Math.max(20, cutoffHz * 0.12), maximum: Math.min(20000, sampleRate / 2)};
}

/** Keep a symmetric cutoff sweep away from DC and below the filter's upper limit. */
export function limitFilterModulationDepth(depthHz: number, cutoffHz: number, sampleRate: number): number {
  const {minimum, maximum} = getFilterModulationLimits(cutoffHz, sampleRate);
  return Math.max(0, Math.min(depthHz, cutoffHz - minimum, maximum - cutoffHz));
}

export function getEffectiveCutoffLfoDepth(
  requestedDepth: number, sweep: {base: number; lower: number; upper: number}, sampleRate: number
): number {
  const {base, lower, upper} = sweep;
  const maximumDepth = limitFilterModulationDepth(Infinity, base, sampleRate);
  const occupiedDepth = Math.max(base - lower, upper - base);
  return Math.min(requestedDepth, Math.max(0, maximumDepth - occupiedDepth));
}

export function applyPitchOffset(frequencyHz: number, cents: number): number {
  return frequencyHz * 2 ** (cents / 1200);
}
