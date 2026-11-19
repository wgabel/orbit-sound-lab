import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings, readDroneKeyGain, validateDroneSettings } from './drone';
describe('drone settings', () => {
  it('creates exactly five independent oscillators', () => { const settings = createDefaultDroneSettings(); expect(settings.oscillators).toHaveLength(5); expect(new Set(settings.oscillators.map(oscillator => oscillator.id)).size).toBe(5); expect(() => validateDroneSettings(settings)).not.toThrow(); });
  it('rejects invalid gain', () => { expect(() => validateDroneSettings({...createDefaultDroneSettings(),gain:2})).toThrow(); });
  it('retains the legacy level for keys until a separate key level is saved', () => {
    const legacy = {...createDefaultDroneSettings(),gain:0.28};
    expect(readDroneKeyGain(legacy)).toBe(0.28);
    expect(readDroneKeyGain({...legacy,keyGain:0})).toBe(0);
    expect(readDroneKeyGain({...legacy,gain:0.8})).toBe(0.4);
    expect(() => validateDroneSettings({...legacy,gain:0.8,keyGain:0.4})).not.toThrow();
    expect(() => validateDroneSettings({...legacy,keyGain:0.41})).toThrow(/key level/);
  });
});
