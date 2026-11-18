import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings } from './drone';
import { createDefaultLowFrequencyOscillators } from './modulation';
import { createDefaultDelaySettings } from './delay';
import { createPreset } from './preset-library';
import { morphPresets } from './preset-morphing';

describe('preset morphing', () => {
  const drone = createDefaultDroneSettings();
  const modulation = createDefaultLowFrequencyOscillators(drone.oscillators.map(item => item.id));
  const a = createPreset('A', drone, modulation, createDefaultDelaySettings());
  const b = createPreset('B', {...drone, gain: 0.24, oscillators: drone.oscillators.map(item => ({...item, frequencyHz: 440, volume: 0, pan: 1, waveform: 'sine' as const, enabled: false}))}, modulation, {...createDefaultDelaySettings(), mix: 0.75});
  it('returns exact endpoint settings', () => {
    expect(morphPresets(a, b, 0).drone).toEqual(a.drone);
    expect(morphPresets(a, b, 1).drone).toEqual(b.drone);
  });
  it('interpolates frequency logarithmically and volume and pan linearly', () => {
    const middle = morphPresets(a, b, 0.5);
    expect(middle.drone.oscillators[0].frequencyHz).toBeCloseTo(220);
    expect(middle.drone.oscillators[0].volume).toBeCloseTo(0.5);
    expect(middle.drone.oscillators[0].pan).toBeCloseTo(0.5);
    expect(middle.drone.gain).toBeCloseTo(0.18);
  });
  it('switches waveform and enabled state at the midpoint', () => {
    expect(morphPresets(a, b, 0.49).drone.oscillators[0].waveform).toBe('sawtooth');
    expect(morphPresets(a, b, 0.5).drone.oscillators[0].waveform).toBe('sine');
    expect(morphPresets(a, b, 0.5).drone.oscillators[0].enabled).toBe(false);
  });
  it('morphs layer B independently and switches its enable state at the midpoint', () => {
    const from = a.layerMix.secondLayer;
    const to = {...from, enabled: true, drone: {...from.drone, gain: 0.28}};
    const destination = {...b, layerMix: {...b.layerMix, secondLayer: to}};
    expect(morphPresets(a, destination, 0.49).layerMix.secondLayer.enabled).toBe(false);
    const middle = morphPresets(a, destination, 0.5).layerMix.secondLayer;
    expect(middle.enabled).toBe(true);
    expect(middle.drone.gain).toBeCloseTo(0.20);
    expect(morphPresets(a, destination, 1).layerMix.secondLayer).toEqual(to);
  });
  it('rejects invalid positions', () => {
    expect(() => morphPresets(a, b, Number.NaN)).toThrow();
    expect(() => morphPresets(a, b, 1.5)).toThrow();
  });
});
