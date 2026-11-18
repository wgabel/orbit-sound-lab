import { describe, expect, it } from 'vitest';
import { applyPitchOffset, getEffectiveCutoffLfoDepth, limitFilterModulationDepth, createDefaultLowFrequencyOscillatorSettings, createDefaultLowFrequencyOscillators, validateLowFrequencyOscillatorSettings } from './modulation';
describe('LFO settings', () => {
  it('creates three independent lanes for every oscillator', () => {
    const bank = createDefaultLowFrequencyOscillators(['a','b']);
    expect(bank).toHaveLength(6);
    expect(bank.filter(item => item.targetOscillatorId === 'a').map(item => item.destination)).toEqual(['pitch','filterCutoff','amplitude']);
  });
  it('accepts defaults', () => expect(() => validateLowFrequencyOscillatorSettings(createDefaultLowFrequencyOscillatorSettings())).not.toThrow());
  it('accepts Smooth Random for each independent LFO route', () => {
    for (const settings of createDefaultLowFrequencyOscillators(['oscillator-1'])) {
      expect(() => validateLowFrequencyOscillatorSettings({...settings, waveform: 'smoothRandom'})).not.toThrow();
    }
  });
  it('accepts old settings and validates optional sync and phase', () => {
    const legacy = createDefaultLowFrequencyOscillatorSettings();
    expect(() => validateLowFrequencyOscillatorSettings(legacy)).not.toThrow();
    expect(() => validateLowFrequencyOscillatorSettings({...legacy, sync: true, phaseDegrees: 180})).not.toThrow();
    expect(() => validateLowFrequencyOscillatorSettings({...legacy, phaseDegrees: 361})).toThrow('phase');
  });
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

it('converts the pitch LFO depth in cents to a frequency offset', () => {
  expect(applyPitchOffset(440, -25)).toBeCloseTo(433.69, 2);
  expect(applyPitchOffset(440, 25)).toBeCloseTo(446.4, 2);
  expect(applyPitchOffset(440, 1200)).toBe(880);
});

it('accounts for the oscillator route when limiting cutoff LFO depth', () => {
  const sweep = {base: 1344, lower: 1244, upper: 1444};
  expect(getEffectiveCutoffLfoDepth(50, sweep, 48000)).toBe(50);
  expect(getEffectiveCutoffLfoDepth(4950, sweep, 48000)).toBeCloseTo(1082.72);
  expect(getEffectiveCutoffLfoDepth(4950, {base: 20, lower: 20, upper: 20}, 48000)).toBe(0);
});
