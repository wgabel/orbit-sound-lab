import { describe, expect, it } from 'vitest';
import { createDefaultLowFrequencyOscillatorSettings, validateLowFrequencyOscillatorSettings } from './modulation';
describe('LFO settings', () => {
  it('accepts defaults', () => expect(() => validateLowFrequencyOscillatorSettings(createDefaultLowFrequencyOscillatorSettings())).not.toThrow());
  it('rejects invalid frequency and depth', () => {
    const settings = createDefaultLowFrequencyOscillatorSettings();
    expect(() => validateLowFrequencyOscillatorSettings({...settings,frequencyHz:0})).toThrow();
    expect(() => validateLowFrequencyOscillatorSettings({...settings,depthCents:Infinity})).toThrow();
  });
});
