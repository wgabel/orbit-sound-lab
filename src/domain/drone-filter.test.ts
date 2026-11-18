import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings, validateDroneSettings, validateLowPassFilterSettings } from './drone';

describe('per-oscillator low-pass filters', () => {
  it('creates five independent bypassed filter configurations', () => {
    const settings = createDefaultDroneSettings();
    expect(settings.oscillators).toHaveLength(5);
    expect(settings.oscillators.every(oscillator => !oscillator.filter.enabled)).toBe(true);
    const first = settings.oscillators[0];
    const updated = {...settings, oscillators: settings.oscillators.map(item => item.id === first.id ? {...item, filter: {...item.filter, enabled: true, cutoffHz: 600}} : item)};
    validateDroneSettings(updated);
    expect(updated.oscillators[0].filter.cutoffHz).toBe(600);
    expect(updated.oscillators[1].filter.cutoffHz).toBe(2400);
  });
  it('rejects invalid filter cutoff and resonance', () => {
    expect(() => validateLowPassFilterSettings({enabled: true, cutoffHz: 0, resonance: 1})).toThrow();
    expect(() => validateLowPassFilterSettings({enabled: true, cutoffHz: 400, resonance: Number.NaN})).toThrow();
    expect(() => validateLowPassFilterSettings({enabled: false, cutoffHz: 20001, resonance: 1})).toThrow();
  });
});
