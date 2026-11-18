import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings } from './drone';
import { createDefaultDelaySettings } from './delay';
import { createDefaultLowFrequencyOscillators } from './modulation';
import { createPreset, validatePreset } from './preset-library';

describe('preset schema', () => {
  const drone = createDefaultDroneSettings();
  const modulation = createDefaultLowFrequencyOscillators(drone.oscillators.map(oscillator => oscillator.id));
  const delay = createDefaultDelaySettings();
  it('creates a versioned snapshot with all five oscillators and LFOs', () => {
    const stereoDrone = {...drone, oscillators: drone.oscillators.map((oscillator, index) =>
      ({...oscillator, pan: (index - 2) / 2}))};
    const preset = createPreset('Ambient', stereoDrone, modulation, delay);
    expect(preset.schemaVersion).toBe(1);
    expect(preset.drone.oscillators).toHaveLength(5);
    expect(preset.modulation).toHaveLength(15);
    expect(validatePreset(JSON.parse(JSON.stringify(preset)))).toEqual(preset);
  });
  it('centers legacy oscillators and rejects invalid pan values', () => {
    const preset = createPreset('Ambient', drone, modulation, delay);
    const legacyOscillators = drone.oscillators.map(({pan: _pan, ...oscillator}) => oscillator);
    const legacyPreset = {...preset, drone: {...drone, oscillators: legacyOscillators}};
    expect(validatePreset(legacyPreset).drone.oscillators.map(oscillator => oscillator.pan)).toEqual([0, 0, 0, 0, 0]);

    for (const pan of [-1.1, 1.1, Number.NaN, null, 'left']) {
      const oscillators = [{...drone.oscillators[0], pan}, ...drone.oscillators.slice(1)];
      expect(() => validatePreset({...preset, drone: {...drone, oscillators}})).toThrow('Oscillator pan');
    }
  });
  it('rejects unsupported schema versions', () => {
    const preset = createPreset('Ambient', drone, modulation, delay);
    expect(() => validatePreset({...preset, schemaVersion: 2})).toThrow('Unsupported preset version');
  });
  it('rejects mismatched LFO targets and invalid volume', () => {
    const preset = createPreset('Ambient', drone, modulation, delay);
    expect(() => validatePreset({...preset, modulation: modulation.slice(1)})).toThrow();
    expect(() => validatePreset({...preset, drone: {...drone, oscillators: drone.oscillators.map((oscillator, index) => index === 0 ? {...oscillator, volume: 2} : oscillator)}})).toThrow();
  });
});
