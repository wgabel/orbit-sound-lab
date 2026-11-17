export const OSCILLATORS_PER_DRONE = 5 as const;
export type OscillatorWaveform = 'sawtooth' | 'sine' | 'square' | 'triangle';
export interface OscillatorSettings { readonly id: string; readonly frequencyHz: number; readonly detuneCents: number; readonly enabled: boolean; readonly waveform: OscillatorWaveform; }
export interface DroneSettings { readonly id: string; readonly name: string; readonly gain: number; readonly oscillators: readonly OscillatorSettings[]; }
export function createDefaultDroneSettings(): DroneSettings {
  return { id: 'drone-1', name: 'Drone 1', gain: 0.12, oscillators: Array.from({length: OSCILLATORS_PER_DRONE}, (_, index) => ({id: `oscillator-${index + 1}`, frequencyHz: 110, detuneCents: (index - 2) * 3, enabled: true, waveform: 'sawtooth' as const})) };
}
export function validateDroneSettings(settings: DroneSettings): void {
  if (settings.oscillators.length !== OSCILLATORS_PER_DRONE) throw new Error('A drone must contain exactly five oscillators.');
  if (!Number.isFinite(settings.gain) || settings.gain < 0 || settings.gain > 1) throw new Error('Invalid drone gain.');
  if (new Set(settings.oscillators.map(oscillator => oscillator.id)).size !== OSCILLATORS_PER_DRONE) throw new Error('Oscillator identifiers must be unique.');
  for (const oscillator of settings.oscillators) {
    if (!Number.isFinite(oscillator.frequencyHz) || oscillator.frequencyHz < 20 || oscillator.frequencyHz > 20000) throw new Error('Invalid oscillator frequency.');
    if (!Number.isFinite(oscillator.detuneCents) || Math.abs(oscillator.detuneCents) > 2400) throw new Error('Invalid oscillator detune.');
  }
}
