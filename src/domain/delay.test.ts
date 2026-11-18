import { describe, expect, it } from 'vitest';
import { createDefaultDelaySettings, validateDelaySettings } from './delay';

describe('master delay settings', () => {
  it('starts bypassed to preserve the original sound', () => {
    const defaults = createDefaultDelaySettings();
    expect(defaults.enabled).toBe(false);
    expect(() => validateDelaySettings(defaults)).not.toThrow();
  });
  it('bounds feedback below unity and time to the allocated delay buffer', () => {
    const defaults = createDefaultDelaySettings();
    expect(() => validateDelaySettings({...defaults, feedback: 1})).toThrow();
    expect(() => validateDelaySettings({...defaults, timeSeconds: 2.1})).toThrow();
    expect(() => validateDelaySettings({...defaults, mix: Number.NaN})).toThrow();
    expect(() => validateDelaySettings({...defaults, feedback: 0.85, timeSeconds: 2, mix: 1})).not.toThrow();
  });
});
