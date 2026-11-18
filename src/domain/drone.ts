export const OSCILLATORS_PER_DRONE = 5 as const;
export type OscillatorWaveform = 'sawtooth' | 'sine' | 'square' | 'triangle';
export interface LowPassFilterSettings {
  readonly enabled: boolean;
  readonly cutoffHz: number;
  readonly resonance: number;
}
export interface AmplitudeEnvelopeSettings {
  readonly enabled: boolean;
  readonly attackSeconds: number;
  readonly decaySeconds: number;
  readonly sustainLevel: number;
  readonly releaseSeconds: number;
}
export function validateAmplitudeEnvelopeSettings(envelope: AmplitudeEnvelopeSettings): void {
  for (const duration of [envelope.attackSeconds, envelope.decaySeconds, envelope.releaseSeconds]) {
    if (!Number.isFinite(duration) || duration < 0.01 || duration > 30) throw new Error('Envelope durations must be between 0.01 and 30 seconds.');
  }
  if (!Number.isFinite(envelope.sustainLevel) || envelope.sustainLevel < 0 || envelope.sustainLevel > 1) throw new Error('Envelope sustain must be between 0 and 1.');
}
export interface OscillatorSettings {
  readonly envelope: AmplitudeEnvelopeSettings;
  readonly id: string;
  readonly frequencyHz: number;
  readonly detuneCents: number;
  readonly enabled: boolean;
  readonly waveform: OscillatorWaveform;
  readonly filter: LowPassFilterSettings;
}
export interface DroneSettings { readonly id: string; readonly name: string; readonly gain: number; readonly oscillators: readonly OscillatorSettings[]; }
export function createDefaultDroneSettings(): DroneSettings {
  return { id: 'drone-1', name: 'Drone 1', gain: 0.12, oscillators: Array.from({length: OSCILLATORS_PER_DRONE}, (_, index) => ({
    id: `oscillator-${index + 1}`, frequencyHz: 110, detuneCents: (index - 2) * 3,
    enabled: true, waveform: 'sawtooth' as const,
    filter: {enabled: false, cutoffHz: 2400, resonance: 0.7},
    envelope: {enabled: false, attackSeconds: 0.5, decaySeconds: 0.5, sustainLevel: 0.7, releaseSeconds: 1.5}
  })) };
}
export function validateLowPassFilterSettings(settings: LowPassFilterSettings): void {
  if (!Number.isFinite(settings.cutoffHz) || settings.cutoffHz < 20 || settings.cutoffHz > 20000) throw new Error('Filter cutoff must be between 20 and 20000 Hz.');
  if (!Number.isFinite(settings.resonance) || settings.resonance < 0.1 || settings.resonance > 20) throw new Error('Filter resonance must be between 0.1 and 20.');
}
export function validateDroneSettings(settings: DroneSettings): void {
  if (settings.oscillators.length !== OSCILLATORS_PER_DRONE) throw new Error('A drone must contain exactly five oscillators.');
  if (!Number.isFinite(settings.gain) || settings.gain < 0 || settings.gain > 1) throw new Error('Invalid drone gain.');
  if (new Set(settings.oscillators.map(oscillator => oscillator.id)).size !== OSCILLATORS_PER_DRONE) throw new Error('Oscillator identifiers must be unique.');
  for (const oscillator of settings.oscillators) {
    if (!Number.isFinite(oscillator.frequencyHz) || oscillator.frequencyHz < 20 || oscillator.frequencyHz > 20000) throw new Error('Invalid oscillator frequency.');
    if (!Number.isFinite(oscillator.detuneCents) || Math.abs(oscillator.detuneCents) > 2400) throw new Error('Invalid oscillator detune.');
    if (!['sine','triangle','sawtooth','square'].includes(oscillator.waveform)) throw new Error('Invalid oscillator waveform.');
    validateLowPassFilterSettings(oscillator.filter);
    validateAmplitudeEnvelopeSettings(oscillator.envelope);
  }
}
