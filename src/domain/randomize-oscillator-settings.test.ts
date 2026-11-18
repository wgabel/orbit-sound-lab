import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDroneSettings } from './drone';
import { createDefaultLowFrequencyOscillators } from './modulation';
import { randomizeOscillatorSettings } from './randomize-oscillator-settings';

afterEach(() => vi.restoreAllMocks());

describe('oscillator randomization', () => {
  const original = createDefaultDroneSettings().oscillators[0];
  const modulations = createDefaultLowFrequencyOscillators([original.id]);

  it('varies each numeric setting within five percent and preserves discrete settings', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const oscillator = {...original, detuneCents: -50, volume: 0.6, pan: 0.3};
    const result = randomizeOscillatorSettings(oscillator, modulations, 'variant');
    expect(result.oscillator).toEqual({
      ...oscillator, frequencyHz: 104.5, detuneCents: -52.5, volume: 0.57,
      filter: {...oscillator.filter, cutoffHz: 2280, resonance: 0.665}
    });
    expect(result.modulations).toEqual(modulations.map(modulation => ({
      ...modulation, frequencyHz: 0.19, depthCents: 14.25, depthHz: 380, depthAmplitude: 0.3325
    })));
  });

  it('respects slider limits, zero, and older preset values outside the sliders', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const oscillator = {...original, frequencyHz: 20000, detuneCents: 0, volume: 1,
      filter: {...original.filter, cutoffHz: 20000, resonance: 12}};
    const result = randomizeOscillatorSettings(oscillator, modulations, 'variant').oscillator;
    expect(result.frequencyHz).toBeLessThanOrEqual(20000);
    expect(result.frequencyHz).toBeGreaterThanOrEqual(19000);
    expect(result.detuneCents).toBe(0);
    expect(result.volume).toBeLessThanOrEqual(1);
    expect(result.filter.cutoffHz).toBeLessThanOrEqual(20000);
    expect(result.filter.resonance).toBeLessThanOrEqual(12);
  });

  it('keeps all three LFO destinations when fully randomizing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const result = randomizeOscillatorSettings(original, modulations, 'random');
    expect(result.modulations.map(item => item.destination)).toEqual(['pitch', 'filterCutoff', 'amplitude']);
    expect(result.modulations.every(item => item.targetOscillatorId === original.id)).toBe(true);
  });
});
