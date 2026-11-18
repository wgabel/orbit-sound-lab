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
  it('clips either side of a range independently and keeps a safe cutoff floor', () => {
    expect(getOscillatorModulationRange({...first, filter: {...first.filter, cutoffHz: 1200}}, 'cutoff', 300))
      .toEqual({base: 1200, lower: 900, upper: 1500});
    expect(getOscillatorModulationRange({...first, filter: {...first.filter, cutoffHz: 1200}}, 'cutoff', 3000))
      .toEqual({base: 1200, lower: 144, upper: 4200});
    expect(getOscillatorModulationRange({...first, volume: 1}, 'volume', 0.25))
      .toEqual({base: 1, lower: 0.75, upper: 1});
  });

  it('rejects frequency feedback loops and accepts a raw source routed to several sliders', () => {
    const routes = [frequencyRoute(first.id, second.id), frequencyRoute(second.id, third.id)];
    expect(() => validateDroneSettings({...drone, oscillatorModulations: [...routes, frequencyRoute(third.id, first.id)]}))
      .toThrow('feedback loop');
    const cutoff = {...frequencyRoute(third.id, first.id), parameter: 'cutoff' as const};
    expect(() => validateDroneSettings({...drone, oscillatorModulations: [...routes, cutoff]})).not.toThrow();
    expect(() => validateDroneSettings({...drone, oscillatorModulations: [frequencyRoute(first.id, first.id)]}))
      .toThrow('Invalid oscillator modulation route');
  });

  it('replaces a slider route and round-trips the settings through a preset', () => {
    const route = frequencyRoute(first.id, second.id);
    const edited = {...route, sourceId: third.id, depth: 50};
    const routes = replaceOscillatorModulationRoute([route], edited);
    const modulations = createDefaultLowFrequencyOscillators(drone.oscillators.map(oscillator => oscillator.id));
    const preset = createPreset('Modulated', {...drone, oscillatorModulations: routes}, modulations, createDefaultDelaySettings());
    expect(validatePreset(JSON.parse(JSON.stringify(preset))).drone.oscillatorModulations).toEqual([edited]);
  });
});
