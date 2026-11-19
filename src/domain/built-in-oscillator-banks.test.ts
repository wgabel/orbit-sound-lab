import { describe, expect, it } from 'vitest';
import { builtInOscillatorBanks, loadBuiltInOscillatorBank } from './built-in-oscillator-banks';
import { createDefaultDroneLayer } from './drone-layers';
import { getEffectiveOscillatorFrequency } from './harmony';

describe('built-in oscillator banks', () => {
  const layer = createDefaultDroneLayer('B');

  it('loads five playable oscillators and valid modulation into the destination slots', () => {
    expect(builtInOscillatorBanks).toHaveLength(5);
    const frequencySets = new Set<string>();
    for (const {id} of builtInOscillatorBanks) {
      const loaded = loadBuiltInOscillatorBank(id, layer);
      const oscillators = loaded.drone.oscillators;
      expect(oscillators.map(oscillator => oscillator.id)).toEqual(layer.drone.oscillators.map(oscillator => oscillator.id));
      expect(oscillators.filter(oscillator => oscillator.enabled && oscillator.volume > 0)).toHaveLength(5);
      expect(loaded.modulation).toHaveLength(20);
      expect(loaded.modulation.some(settings => settings.enabled)).toBe(true);
      frequencySets.add(oscillators.map(oscillator => oscillator.frequencyHz).join(','));
    }
    expect(frequencySets.size).toBe(5);
  });

  it('plays the designed tuning and replaces oscillator routing while retaining layer controls', () => {
    const [first, second] = layer.drone.oscillators;
    const settings = {...layer, harmony: {...layer.harmony, mode: 'piano' as const, rootFrequencyHz: 200},
      drone: {...layer.drone, gain: 0.2, oscillatorModulations: [
        {targetId: first.id, sourceId: second.id, parameter: 'frequency' as const, enabled: true, depth: 20}
      ]}};
    const loaded = loadBuiltInOscillatorBank('open-fifths', settings);
    expect(loaded.drone.oscillators.map((oscillator, index) =>
      getEffectiveOscillatorFrequency(loaded.harmony, oscillator.frequencyHz, index))).toEqual([55, 82.5, 110, 165, 220]);
    expect(loaded.drone.oscillatorModulations).toEqual([]);
    expect(loaded.drone.gain).toBe(settings.drone.gain);
    expect(loaded.drone.mix).toBe(settings.drone.mix);
    expect(loaded.drone.envelope).toBe(settings.drone.envelope);
    expect(loaded.enabled).toBe(settings.enabled);
  });
});
