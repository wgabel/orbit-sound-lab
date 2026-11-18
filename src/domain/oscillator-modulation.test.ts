import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings, validateDroneSettings } from './drone';
import { createDefaultDelaySettings } from './delay';
import { createDefaultLowFrequencyOscillators } from './modulation';
import { getOscillatorModulationRange, getOscillatorSliderSpan, replaceOscillatorModulationRoute } from './oscillator-modulation';
import type { OscillatorModulationRoute } from './oscillator-modulation';
import { createPreset, validatePreset } from './preset-library';

const drone = createDefaultDroneSettings();
const [first, second, third] = drone.oscillators;
const frequencyRoute = (targetId: string, sourceId: string): OscillatorModulationRoute =>
  ({targetId, sourceId, parameter: 'frequency', depth: 30, enabled: true});

describe('oscillator slider modulation', () => {
  it('uses bipolar depth as a percentage of the full target span and limits the endpoints', () => {
    expect(getOscillatorModulationRange({...first, volume: 0.5}, 'volume', getOscillatorSliderSpan('volume') * 0.1))
      .toEqual({base: 0.5, lower: 0.4, upper: 0.6});
    expect(getOscillatorModulationRange({...first, frequencyHz: 400}, 'frequency', getOscillatorSliderSpan('frequency') * 0.1))
      .toEqual({base: 400, lower: 316, upper: 484});
    const filtered = {...first, filter: {...first.filter, cutoffHz: 1200}};
    expect(getOscillatorModulationRange(filtered, 'cutoff', getOscillatorSliderSpan('cutoff') * 0.1))
      .toEqual({base: 1200, lower: 144, upper: 3198});
    expect(getOscillatorModulationRange({...first, volume: 1}, 'volume', 0.25))
      .toEqual({base: 1, lower: 0.75, upper: 1});
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
