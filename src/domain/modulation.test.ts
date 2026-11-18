import { describe, expect, it } from 'vitest';
import { limitFilterModulationDepth, createDefaultLowFrequencyOscillatorSettings, createDefaultLowFrequencyOscillators, validateLowFrequencyOscillatorSettings } from './modulation';
describe('LFO settings', () => {
  it('creates three independent lanes for every oscillator', () => {
    const bank = createDefaultLowFrequencyOscillators(['a','b']);
    expect(bank).toHaveLength(6);
    expect(bank.filter(item => item.targetOscillatorId === 'a').map(item => item.destination)).toEqual(['pitch','filterCutoff','amplitude']);
  });
  it('accepts defaults', () => expect(() => validateLowFrequencyOscillatorSettings(createDefaultLowFrequencyOscillatorSettings())).not.toThrow());
  it('rejects invalid frequency and depth', () => {
    const settings = createDefaultLowFrequencyOscillatorSettings();
    expect(() => validateLowFrequencyOscillatorSettings({...settings,frequencyHz:0})).toThrow();
    expect(() => validateLowFrequencyOscillatorSettings({...settings,depthCents:Infinity})).toThrow();
  });
});

it('limits only the effective cutoff depth to the available symmetric range', () => {
  expect(limitFilterModulationDepth(100, 1344, 48000)).toBe(100);
  expect(limitFilterModulationDepth(4950, 1344, 48000)).toBeCloseTo(1182.72);
  expect(limitFilterModulationDepth(4950, 20, 48000)).toBe(0);
  expect(limitFilterModulationDepth(4950, 15000, 32000)).toBe(1000);
});
