import { validateOscillatorSettings } from './drone';
import { validateLowFrequencyOscillatorBank } from './modulation';
import type { OscillatorSnapshot } from './oscillator-clipboard';

export const OSCILLATOR_PRESET_NAME_LIMIT = 120;

export interface OscillatorPreset {
  readonly kind: 'orbit-oscillator';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly snapshot: OscillatorSnapshot;
}

export function readOscillatorPreset(value: unknown): OscillatorPreset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid oscillator preset.');
  const {kind,schemaVersion,id,name,createdAt,snapshot} = value as Partial<OscillatorPreset>;
  if (kind !== 'orbit-oscillator' || schemaVersion !== 1 || typeof id !== 'string' || !id ||
      typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) {
    throw new Error('Invalid oscillator preset metadata.');
  }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > OSCILLATOR_PRESET_NAME_LIMIT) {
    throw new Error(`Enter a preset name up to ${OSCILLATOR_PRESET_NAME_LIMIT} characters.`);
  }
  const oscillator = snapshot?.oscillator;
  if (!oscillator || typeof oscillator.id !== 'string' || !oscillator.id ||
      typeof oscillator.enabled !== 'boolean' || typeof oscillator.filter?.enabled !== 'boolean' ||
      !oscillator.fade || !Array.isArray(snapshot?.modulations) ||
      snapshot.modulations.some(modulation => typeof modulation?.enabled !== 'boolean')) {
    throw new Error('Incomplete oscillator preset settings.');
  }
  validateOscillatorSettings(oscillator);
  validateLowFrequencyOscillatorBank(snapshot.modulations,[oscillator.id]);
  return {kind,schemaVersion,id,name:name.trim(),createdAt,snapshot:structuredClone(snapshot)};
}
