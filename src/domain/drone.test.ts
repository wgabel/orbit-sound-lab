import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings, validateDroneSettings } from './drone';
describe('drone settings', () => {
  it('creates exactly five independent oscillators', () => { const settings = createDefaultDroneSettings(); expect(settings.oscillators).toHaveLength(5); expect(new Set(settings.oscillators.map(oscillator => oscillator.id)).size).toBe(5); expect(() => validateDroneSettings(settings)).not.toThrow(); });
  it('rejects invalid gain', () => { expect(() => validateDroneSettings({...createDefaultDroneSettings(),gain:2})).toThrow(); });
});
