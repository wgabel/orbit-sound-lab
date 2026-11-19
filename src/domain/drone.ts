import { DEFAULT_DRONE_ENVELOPE, validateDroneEnvelope } from './drone-envelope';
import type { DroneEnvelope } from './drone-envelope';

import { validateOscillatorModulationRoutes } from './oscillator-modulation';
import type { OscillatorModulationRoute } from './oscillator-modulation';

export const OSCILLATORS_PER_DRONE = 5 as const;
export const OSCILLATOR_WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square', 'sineTriangle', 'variablePulse', 'foldedSine'] as const;
export type OscillatorWaveform = typeof OSCILLATOR_WAVEFORMS[number];
export const DEFAULT_OSCILLATOR_SHAPE = 0.5;
export const MINIMUM_PULSE_WIDTH = 0.05;
export const MAXIMUM_PULSE_WIDTH = 0.95;
export function supportsOscillatorShape(waveform: OscillatorWaveform): boolean {
  return waveform === 'sineTriangle' || waveform === 'variablePulse' || waveform === 'foldedSine';
}
export interface LowPassFilterSettings {
  readonly enabled: boolean;
  readonly cutoffHz: number;
  readonly resonance: number;
}
export interface FadeSettings { readonly fadeInSeconds: number; readonly fadeOutSeconds: number; }
export function validateFadeSettings(settings: FadeSettings): void {
  if (![settings.fadeInSeconds, settings.fadeOutSeconds].every(value => Number.isFinite(value) && value >= 0.01 && value <= 30)) throw new Error('Fade durations must be between 0.01 and 30 seconds.');
}
export interface OscillatorSettings {
  readonly fade: FadeSettings;
  readonly id: string;
  readonly frequencyHz: number;
  readonly volume: number;
  readonly pan: number;
  readonly detuneCents: number;
  readonly enabled: boolean;
  readonly waveform: OscillatorWaveform;
  readonly shape?: number;
  readonly filter: LowPassFilterSettings;
}
export interface DroneReverbSettings {readonly enabled: boolean; readonly mix: number}
export const MAX_SHELF_GAIN_DECIBELS = 12;
export const MIN_SHELF_FREQUENCY_HZ = 20;
export const MAX_SHELF_FREQUENCY_HZ = 20000;

export interface DroneShelfSettings {
  readonly frequencyHz: number;
  readonly gainDecibels: number;
}

export interface DroneMixSettings {
  readonly noise: {readonly enabled: boolean; readonly volume: number};
  readonly filter: {readonly enabled: boolean; readonly cutoffHz: number};
  readonly reverb: DroneReverbSettings;
  readonly lowShelf: DroneShelfSettings;
  readonly highShelf: DroneShelfSettings;
}
export interface DroneSettings {
  readonly id: string;
  readonly name: string;
  readonly gain: number;
  readonly envelope: DroneEnvelope;
  readonly oscillatorModulations?: readonly OscillatorModulationRoute[];
  readonly oscillators: readonly OscillatorSettings[];
  readonly mix: DroneMixSettings;
}
export function createDefaultDroneMix(): DroneMixSettings {
  return {
    noise: {enabled: false, volume: 0.2},
    filter: {enabled: false, cutoffHz: 2400},
    reverb: {enabled: false, mix: 0.25},
    lowShelf: {frequencyHz: 150, gainDecibels: 0},
    highShelf: {frequencyHz: 2400, gainDecibels: 0}
  };
}
export function createDefaultDroneSettings(): DroneSettings {
  return { id: 'drone-1', name: 'Drone 1', gain: 0.12, envelope: DEFAULT_DRONE_ENVELOPE, mix: createDefaultDroneMix(), oscillators: Array.from({length: OSCILLATORS_PER_DRONE}, (_, index) => ({
    id: `oscillator-${index + 1}`, frequencyHz: 110, volume: 1, pan: 0, detuneCents: (index - 2) * 3,
    enabled: true, waveform: 'sawtooth' as const,
    filter: {enabled: false, cutoffHz: 2400, resonance: 0.7}, fade: {fadeInSeconds: 1, fadeOutSeconds: 2}
  })) };
}
function validateCutoffFrequency(cutoffHz: number): void {
  if (!Number.isFinite(cutoffHz) || cutoffHz < 20 || cutoffHz > 20000) throw new Error('Filter cutoff must be between 20 and 20000 Hz.');
}
function validateDroneShelf(settings: DroneShelfSettings): void {
  if (!settings || !Number.isFinite(settings.frequencyHz) ||
      settings.frequencyHz < MIN_SHELF_FREQUENCY_HZ || settings.frequencyHz > MAX_SHELF_FREQUENCY_HZ) {
    throw new Error('Shelf frequency must be between 20 and 20000 Hz.');
  }
  if (!Number.isFinite(settings.gainDecibels) || Math.abs(settings.gainDecibels) > MAX_SHELF_GAIN_DECIBELS) {
    throw new Error('Shelf gain must be between -12 and +12 dB.');
  }
}
export function validateDroneMix(settings: DroneMixSettings): void {
  if (typeof settings?.noise?.enabled !== 'boolean' || typeof settings?.filter?.enabled !== 'boolean') throw new Error('Invalid drone mix.');
  if (!Number.isFinite(settings.noise.volume) || settings.noise.volume < 0 || settings.noise.volume > 1) throw new Error('Noise level must be between 0 and 1.');
  validateCutoffFrequency(settings.filter.cutoffHz);
  validateDroneShelf(settings.lowShelf);
  validateDroneShelf(settings.highShelf);
  if (typeof settings.reverb?.enabled !== 'boolean' || !Number.isFinite(settings.reverb.mix) || settings.reverb.mix < 0 || settings.reverb.mix > 1) {
    throw new Error('Reverb mix must be between 0 and 1.');
  }
}
export function validateLowPassFilterSettings(settings: LowPassFilterSettings): void {
  validateCutoffFrequency(settings.cutoffHz);
  if (!Number.isFinite(settings.resonance) || settings.resonance < 0.1 || settings.resonance > 20) throw new Error('Filter resonance must be between 0.1 and 20.');
}
export function validateDroneSettings(settings: DroneSettings): void {
  validateDroneMix(settings.mix);
  validateDroneEnvelope(settings.envelope);
  if (settings.oscillators.length !== OSCILLATORS_PER_DRONE) throw new Error('A drone must contain exactly five oscillators.');
  if (!Number.isFinite(settings.gain) || settings.gain < 0 || settings.gain > 1) throw new Error('Invalid drone gain.');
  if (new Set(settings.oscillators.map(oscillator => oscillator.id)).size !== OSCILLATORS_PER_DRONE) throw new Error('Oscillator identifiers must be unique.');
  for (const oscillator of settings.oscillators) validateOscillatorSettings(oscillator);
  if (settings.oscillatorModulations !== undefined) validateOscillatorModulationRoutes(settings.oscillatorModulations, settings.oscillators);
}

export function validateOscillatorSettings(oscillator: OscillatorSettings): void {
  if (!Number.isFinite(oscillator.frequencyHz) || oscillator.frequencyHz < 20 || oscillator.frequencyHz > 20000) throw new Error('Invalid oscillator frequency.');
  if (!Number.isFinite(oscillator.volume) || oscillator.volume < 0 || oscillator.volume > 1) throw new Error('Oscillator volume must be between 0 and 1.');
  if (!Number.isFinite(oscillator.pan) || Math.abs(oscillator.pan) > 1) throw new Error('Oscillator pan must be between -1 and 1.');
  if (!Number.isFinite(oscillator.detuneCents) || Math.abs(oscillator.detuneCents) > 2400) throw new Error('Invalid oscillator detune.');
  if (!OSCILLATOR_WAVEFORMS.includes(oscillator.waveform)) throw new Error('Invalid oscillator waveform.');
  if (oscillator.shape !== undefined && (!Number.isFinite(oscillator.shape) || oscillator.shape < 0 || oscillator.shape > 1)) {
    throw new Error('Oscillator shape must be between 0 and 1.');
  }
  validateLowPassFilterSettings(oscillator.filter);
  validateFadeSettings(oscillator.fade);
}
