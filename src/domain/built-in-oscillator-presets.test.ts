import { expect, it } from 'vitest';
import { builtInOscillatorPresets, createBuiltInOscillatorSnapshot } from './built-in-oscillator-presets';
import { createDefaultDroneSettings } from './drone';

it('loads each bundled preset into the chosen oscillator with independent LFO targets', () => {
  const target = {...createDefaultDroneSettings().oscillators[2], enabled: false};
  expect(builtInOscillatorPresets.length).toBeGreaterThan(0);
  expect(new Set(builtInOscillatorPresets.map(preset => preset.id)).size).toBe(builtInOscillatorPresets.length);
  for (const preset of builtInOscillatorPresets) {
    const {oscillator, modulations} = createBuiltInOscillatorSnapshot(preset.id, target);
    expect(oscillator.id).toBe(target.id);
    expect(oscillator.enabled).toBe(false);
    expect(modulations.map(item => item.destination)).toEqual(['pitch', 'filterCutoff', 'amplitude', 'shape']);
    expect(modulations.every(item => item.targetOscillatorId === target.id && !item.enabled)).toBe(true);
  }
  expect(createBuiltInOscillatorSnapshot('sine-sub', target).oscillator.waveform).toBe('sine');
});

it('uses the bundled Shape when loading a shaped waveform', () => {
  const target = {...createDefaultDroneSettings().oscillators[0],shape:0.1};
  expect(createBuiltInOscillatorSnapshot('peaked-reed',target).oscillator).toMatchObject({waveform:'peakedSine',shape:0.63});
});
