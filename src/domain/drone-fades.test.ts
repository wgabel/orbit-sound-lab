import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings, validateDroneSettings, validateFadeSettings } from './drone';
import { createDefaultLowFrequencyOscillatorSettings, validateLowFrequencyOscillatorSettings } from './modulation';

describe('continuous drone amplitude controls', () => {
  it('supplies independent fade durations for each oscillator', () => {
    const settings = createDefaultDroneSettings();
    expect(settings.oscillators).toHaveLength(5);
    expect(settings.oscillators.every(item => item.fade.fadeInSeconds > 0 && item.fade.fadeOutSeconds > 0)).toBe(true);
    expect(() => validateDroneSettings(settings)).not.toThrow();
  });
  it('rejects invalid fades', () => {
    expect(() => validateFadeSettings({fadeInSeconds: 0, fadeOutSeconds: 2})).toThrow();
    expect(() => validateFadeSettings({fadeInSeconds: 1, fadeOutSeconds: Number.NaN})).toThrow();
    expect(() => validateFadeSettings({fadeInSeconds: 1, fadeOutSeconds: 31})).toThrow();
  });
  it('accepts amplitude routing with bounded depth', () => {
    const original = createDefaultLowFrequencyOscillatorSettings();
    expect(() => validateLowFrequencyOscillatorSettings({...original, destination: 'amplitude', depthAmplitude: 0.5})).not.toThrow();
    expect(() => validateLowFrequencyOscillatorSettings({...original, destination: 'amplitude', depthAmplitude: 0.6})).toThrow();
  });
});
