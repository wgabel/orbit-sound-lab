import { describe, expect, it } from 'vitest';
import { createDefaultLowFrequencyOscillatorSettings, createDefaultLowFrequencyOscillators, validateLowFrequencyOscillatorSettings } from './modulation';
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
