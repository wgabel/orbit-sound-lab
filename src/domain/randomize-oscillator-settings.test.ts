import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDroneSettings } from './drone';
import { createDefaultLowFrequencyOscillators } from './modulation';
import { randomizeOscillatorSettings } from './randomize-oscillator-settings';

afterEach(() => vi.restoreAllMocks());

describe('oscillator randomization', () => {
  const original = createDefaultDroneSettings().oscillators[0];
  const modulations = createDefaultLowFrequencyOscillators([original.id]);

  it('varies each numeric setting by up to five percent of its slider span and preserves discrete settings', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const oscillator = {...original, detuneCents: -50, volume: 0.6, pan: 0.3};
    const result = randomizeOscillatorSettings(oscillator, modulations, 'variant');
    expect(result.oscillator).toEqual({
      ...oscillator, frequencyHz: 68, detuneCents: -60, volume: 0.55,
      filter: {...oscillator.filter, cutoffHz: 1401, resonance: 0.105}
    });
    expect(result.modulations).toEqual(modulations.map(modulation => ({
      ...modulation, frequencyHz: 0.01, depthCents: 0, depthHz: 150, depthAmplitude: 0.325
    })));
  });

  it('varies settings near zero without exceeding the slider limits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const oscillator = {...original, detuneCents: 0, volume: 1,
      filter: {...original.filter, cutoffHz: 20, resonance: 12}};
    const zeroDepthModulations = modulations.map(modulation => ({...modulation, depthHz: 0}));
    const result = randomizeOscillatorSettings(oscillator, zeroDepthModulations, 'variant');
    expect(result.oscillator.detuneCents).toBeCloseTo(10, 1);
    expect(result.oscillator.volume).toBeLessThanOrEqual(1);
    expect(result.oscillator.filter.cutoffHz).toBeCloseTo(1018, 1);
    expect(result.oscillator.filter.resonance).toBeLessThanOrEqual(12);
    expect(result.modulations.find(modulation => modulation.destination === 'filterCutoff')?.depthHz).toBe(249.75);
  });

  it('only varies older preset values toward the slider range', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const oscillator = {...original, frequencyHz: 20000, detuneCents: -150};
    const lower = randomizeOscillatorSettings(oscillator, modulations, 'variant').oscillator;
    expect(lower.frequencyHz).toBe(19958);
    expect(lower.detuneCents).toBe(-150);

    random.mockReturnValue(0.999);
    const upper = randomizeOscillatorSettings(oscillator, modulations, 'variant').oscillator;
    expect(upper.frequencyHz).toBeLessThanOrEqual(20000);
    expect(upper.detuneCents).toBe(-140.01);
  });

  it('keeps all three LFO destinations when fully randomizing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const result = randomizeOscillatorSettings(original, modulations, 'random');
    expect(result.modulations.map(item => item.destination)).toEqual(['pitch', 'filterCutoff', 'amplitude']);
    expect(result.modulations.every(item => item.targetOscillatorId === original.id)).toBe(true);
  });
});
