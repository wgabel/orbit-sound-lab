import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings, validateDroneSettings } from './drone';
import { createDefaultDelaySettings } from './delay';
import { createDefaultLowFrequencyOscillators } from './modulation';
import { getOscillatorModulationRange, replaceOscillatorModulationRoute } from './oscillator-modulation';
import type { OscillatorModulationRoute } from './oscillator-modulation';
import { createPreset, validatePreset } from './preset-library';

const drone = createDefaultDroneSettings();
const [first, second, third] = drone.oscillators;
const frequencyRoute = (targetId: string, sourceId: string): OscillatorModulationRoute =>
  ({targetId, sourceId, parameter: 'frequency', depth: 30, enabled: true});

describe('oscillator slider modulation', () => {
  it('uses the base at zero source level and clamps the full-depth endpoint', () => {
    const filtered = {...first, filter: {...first.filter, cutoffHz: 1200}};
    expect(getOscillatorModulationRange(filtered, 'cutoff', 300))
      .toEqual({base: 1200, endpoint: 1500, lower: 1200, upper: 1500});
    expect(getOscillatorModulationRange(filtered, 'cutoff', 3000, 48000, 'decrease'))
      .toEqual({base: 1200, endpoint: 144, lower: 144, upper: 1200});
    expect(getOscillatorModulationRange({...first, volume: 1}, 'volume', 0.25))
      .toEqual({base: 1, endpoint: 0.75, lower: 0.75, upper: 1});
  });

  it('supports reciprocal routes using independent level signals and rejects self-routing', () => {
    const routes = [frequencyRoute(first.id, second.id), frequencyRoute(second.id, first.id)];
    expect(() => validateDroneSettings({...drone, oscillatorModulations: routes})).not.toThrow();
    expect(() => validateDroneSettings({...drone, oscillatorModulations: [frequencyRoute(first.id, first.id)]}))
      .toThrow('Invalid oscillator modulation route');
  });

  it('replaces a slider route and round-trips the settings through a preset', () => {
    const route = frequencyRoute(first.id, second.id);
    const edited = {...route, sourceId: third.id, depth: 50, direction: 'decrease' as const};
    const routes = replaceOscillatorModulationRoute([route], edited);
    const modulations = createDefaultLowFrequencyOscillators(drone.oscillators.map(oscillator => oscillator.id));
    const preset = createPreset('Modulated', {...drone, oscillatorModulations: routes}, modulations, createDefaultDelaySettings());
    expect(validatePreset(JSON.parse(JSON.stringify(preset))).drone.oscillatorModulations).toEqual([edited]);
  });
});
