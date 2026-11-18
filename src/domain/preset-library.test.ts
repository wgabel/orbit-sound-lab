import { describe, expect, it } from 'vitest';
import { createDefaultDroneMix, createDefaultDroneSettings } from './drone';
import { createDefaultDelaySettings } from './delay';
import { createDefaultLowFrequencyOscillators } from './modulation';
import { createDefaultDroneLayer } from './drone-layers';
import { createPreset, loadPresetSound, validatePreset } from './preset-library';

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
    expect(preset.modulation).toHaveLength(20);
    expect(validatePreset(JSON.parse(JSON.stringify(preset)))).toEqual(preset);
  });
  it('loads older modulation banks and round-trips oscillator shape and its LFO', () => {
    const preset = createPreset('Texture', drone, modulation, delay);
    for (const destinations of [['pitch'], ['pitch', 'filterCutoff', 'amplitude']]) {
      const legacy = modulation.filter(item => destinations.includes(item.destination));
      expect(validatePreset({...preset, modulation: legacy}).modulation).toEqual(modulation);
    }
    const oscillators = [{...drone.oscillators[0], waveform: 'sineTriangle' as const, shape: 0.35}, ...drone.oscillators.slice(1)];
    const modulations = modulation.map(item => item.destination === 'shape' && item.targetOscillatorId === oscillators[0].id
      ? {...item, enabled: true, depthShape: 0.18} : item);
    const shaped = createPreset('Shaped', {...drone, oscillators}, modulations, delay);
    expect(validatePreset(JSON.parse(JSON.stringify(shaped)))).toEqual(shaped);
    expect(() => validatePreset({...shaped, drone: {...shaped.drone,
      oscillators: [{...oscillators[0], shape: 1.1}, ...oscillators.slice(1)]}})).toThrow('Oscillator shape');
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
  it('loads old presets into layer A and keeps layer B disabled', () => {
    const {layerMix: _layerMix, ...legacy} = createPreset('Legacy', drone, modulation, delay);
    const normalized = validatePreset(legacy);
    expect(normalized.drone).toEqual(drone);
    expect(normalized.layerMix).toEqual({
      firstLayerEnabled: true, secondLayer: createDefaultDroneLayer('B'), masterGain: 1
    });
  });
  it('round-trips the second layer and the master level', () => {
    const secondLayer = {...createDefaultDroneLayer('B'), enabled: true};
    const layerMix = {firstLayerEnabled: false, secondLayer, masterGain: 0.63};
    const preset = createPreset('Dual layer', drone, modulation, delay, undefined, layerMix);
    expect(validatePreset(JSON.parse(JSON.stringify(preset))).layerMix).toEqual(layerMix);
    expect(() => validatePreset({...preset, layerMix: {...layerMix, masterGain: 2}})).toThrow('Master level');
  });
  it('loads a legacy layer A sound into B and preserves the destination enable state', () => {
    const {sourceLayer: _sourceLayer, ...legacy} = createPreset('Legacy', drone, modulation, delay);
    const destination = createDefaultDroneLayer('B');
    const sound = loadPresetSound(validatePreset(legacy), destination);
    expect(sound.drone).toEqual(drone);
    expect(sound.modulation).toEqual(modulation);
    expect(sound.enabled).toBe(false);
  });
  it('uses the layer selected when the preset was saved', () => {
    const secondLayer = createDefaultDroneLayer('B');
    const mix = {firstLayerEnabled: false, secondLayer, masterGain: 1};
    const preset = createPreset('Texture', drone, modulation, delay, undefined, mix, 'B');
    const normalized = validatePreset(JSON.parse(JSON.stringify(preset)));
    expect(loadPresetSound(normalized, createDefaultDroneLayer('A'))).toEqual({...secondLayer, enabled: true});
    expect(() => validatePreset({...preset, sourceLayer: 'C'})).toThrow('Invalid preset source layer');
  });
  it('defaults legacy mix fields and preserves noise, filter and reverb in both layers', () => {
    const preset = createPreset('Layer texture', drone, modulation, delay);
    const {mix: _firstMix, ...legacyDrone} = drone;
    const {mix: _secondMix, ...legacySecondDrone} = preset.layerMix.secondLayer.drone;
    const legacy = {...preset, drone: legacyDrone, layerMix: {...preset.layerMix,
      secondLayer: {...preset.layerMix.secondLayer, drone: legacySecondDrone}}};
    expect(validatePreset(legacy).drone.mix).toEqual(createDefaultDroneMix());
    expect(validatePreset(legacy).layerMix.secondLayer.drone.mix).toEqual(createDefaultDroneMix());

    const legacyMix = {noise: {enabled: true, volume: 0.37}, filter: {enabled: true, cutoffHz: 840}};
    expect(validatePreset({...preset, drone: {...drone, mix: legacyMix}}).drone.mix)
      .toEqual({...legacyMix, reverb: createDefaultDroneMix().reverb});
    const mix = {...legacyMix, reverb: {enabled: true, mix: 0.41}};
    const withNoise = {...preset, drone: {...drone, mix}, layerMix: {...preset.layerMix,
      secondLayer: {...preset.layerMix.secondLayer, drone: {...legacySecondDrone, mix}}}};
    const roundTrip = validatePreset(JSON.parse(JSON.stringify(withNoise)));
    expect(roundTrip.drone.mix).toEqual(mix);
    expect(roundTrip.layerMix.secondLayer.drone.mix).toEqual(mix);
  });
  it('defaults missing envelopes and round-trips each layer envelope independently', () => {
    const preset = createPreset('Keys', drone, modulation, delay);
    const {envelope: _first, ...legacyDrone} = drone;
    const {envelope: _second, ...legacySecondDrone} = preset.layerMix.secondLayer.drone;
    const legacy = {...preset, drone: legacyDrone, layerMix: {...preset.layerMix,
      secondLayer: {...preset.layerMix.secondLayer, drone: legacySecondDrone}}};
    const normalized = validatePreset(legacy);
    expect(normalized.drone.envelope).toEqual(drone.envelope);
    expect(normalized.layerMix.secondLayer.drone.envelope).toEqual(drone.envelope);

    const envelopeA = {...drone.envelope, attack: 0.4};
    const envelopeB = {...drone.envelope, release: 1.8, sustain: 0.3};
    const edited = {...preset, drone: {...drone, envelope: envelopeA}, layerMix: {...preset.layerMix,
      secondLayer: {...preset.layerMix.secondLayer, drone: {...legacySecondDrone, envelope: envelopeB}}}};
    const restored = validatePreset(JSON.parse(JSON.stringify(edited)));
    expect(restored.drone.envelope).toEqual(envelopeA);
    expect(restored.layerMix.secondLayer.drone.envelope).toEqual(envelopeB);
    expect(() => validatePreset({...edited, drone: {...drone, envelope: {...envelopeA, release: 0}}}))
      .toThrow('Invalid drone volume envelope');
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
