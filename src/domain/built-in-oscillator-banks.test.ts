import { describe, expect, it } from 'vitest';
import { builtInOscillatorBanks, loadBuiltInOscillatorBank, oscillatorBankGroups } from './built-in-oscillator-banks';
import { createDefaultDroneLayer } from './drone-layers';
import { getEffectiveOscillatorFrequency } from './harmony';

describe('built-in oscillator banks', () => {
  const layer = createDefaultDroneLayer('B');

  it('loads five playable oscillators and valid modulation into the destination slots', () => {
    expect(builtInOscillatorBanks).toHaveLength(20);
    const frequencySets = new Set<string>();
    for (const {id} of builtInOscillatorBanks) {
      const loaded = loadBuiltInOscillatorBank(id, layer);
      const oscillators = loaded.drone.oscillators;
      expect(oscillators.map(oscillator => oscillator.id)).toEqual(layer.drone.oscillators.map(oscillator => oscillator.id));
      expect(oscillators.filter(oscillator => oscillator.enabled)).toHaveLength(5);
      expect(oscillators.filter(oscillator => oscillator.volume > 0).length).toBeGreaterThanOrEqual(3);
      expect(loaded.modulation).toHaveLength(20);
      frequencySets.add(oscillators.map(oscillator => oscillator.frequencyHz).join(','));
    }
    expect(frequencySets.size).toBe(20);
  });

  it('groups the five advanced routing banks and loads their routes into either drone', () => {
    expect(oscillatorBankGroups.map(group => group.label)).toEqual(['Drone Foundations', 'Cross-Modulation', 'Routing Example', 'Stepped Drones']);
    const examples = oscillatorBankGroups.find(group => group.label === 'Routing Example')?.presets ?? [];
    expect(examples.map(preset => preset.id)).toEqual(['ion-choir', 'relay-bells', 'split-pulse', 'reed-reactor', 'prism-gate']);
    for (const layerId of ['A', 'B'] as const) {
      for (const preset of examples) {
        const {drone} = loadBuiltInOscillatorBank(preset.id, createDefaultDroneLayer(layerId));
        const routes = drone.oscillatorModulations ?? [];
        expect(routes.length).toBeGreaterThanOrEqual(2);
        expect(routes.some(route => drone.oscillators.find(oscillator => oscillator.id === route.sourceId)?.volume === 0)).toBe(true);
        for (const route of routes) {
          expect(route).toMatchObject({enabled: true, signal: 'waveform'});
          expect(route.depth).toBeGreaterThan(0);
          const target = drone.oscillators.find(oscillator => oscillator.id === route.targetId);
          expect(target?.enabled).toBe(true);
          if (route.parameter === 'cutoff') expect(target?.filter.enabled).toBe(true);
        }
      }
    }
  });

  it('loads five stepped banks with synchronized square LFOs and independent destinations', () => {
    const examples = oscillatorBankGroups.find(group => group.label === 'Stepped Drones')?.presets ?? [];
    expect(examples).toHaveLength(5);
    for (const {id} of examples) {
      const loaded = loadBuiltInOscillatorBank(id, layer);
      const active = loaded.modulation.filter(settings => settings.enabled);
      expect(active.length).toBeGreaterThanOrEqual(4);
      expect(active.every(settings => settings.sync && settings.waveform === 'square')).toBe(true);
    }
    const relay = loadBuiltInOscillatorBank('stereo-relay', layer);
    const [, left, right] = relay.drone.oscillators;
    const getTiming = (oscillatorId: string) => relay.modulation.filter(settings =>
      settings.targetOscillatorId === oscillatorId && settings.enabled)
      .map(({destination, frequencyHz, phaseDegrees}) => ({destination, frequencyHz, phaseDegrees}));
    expect(getTiming(left.id)).toEqual([
      {destination: 'filterCutoff', frequencyHz: 0.4, phaseDegrees: 0},
      {destination: 'amplitude', frequencyHz: 0.4, phaseDegrees: 0}
    ]);
    expect(getTiming(right.id)).toEqual([
      {destination: 'filterCutoff', frequencyHz: 0.4, phaseDegrees: 180},
      {destination: 'amplitude', frequencyHz: 0.4, phaseDegrees: 180}
    ]);
  });

  it.each([
    {id: 'velvet-current', destinations: [{sourceSlot: 2, targetSlot: 3, parameter: 'frequency'}]},
    {id: 'glass-bell', destinations: [{sourceSlot: 2, targetSlot: 3, parameter: 'frequency'}]},
    {id: 'cascade-drift', destinations: [
      {sourceSlot: 2, targetSlot: 3, parameter: 'frequency'},
      {sourceSlot: 3, targetSlot: 4, parameter: 'frequency'}
    ]},
    {id: 'copper-pulse', destinations: [{sourceSlot: 2, targetSlot: 3, parameter: 'volume'}]},
    {id: 'breathing-reed', destinations: [{sourceSlot: 2, targetSlot: 3, parameter: 'cutoff'}]}
  ])('loads $id routes into either layer, with OSC 2 audible only through modulation', ({id, destinations}) => {
    for (const layerId of ['A', 'B'] as const) {
      const layer = createDefaultDroneLayer(layerId);
      const [first, second] = layer.drone.oscillators;
      const previous = {...layer, drone: {...layer.drone, oscillatorModulations: [
        {targetId: first.id, sourceId: second.id, parameter: 'frequency' as const, enabled: true, depth: 20}
      ]}};
      const {oscillators, oscillatorModulations} = loadBuiltInOscillatorBank(id, previous).drone;
      expect(oscillators[1]).toMatchObject({enabled: true, volume: 0});
      expect(oscillatorModulations).toEqual(destinations.map(({sourceSlot, targetSlot, parameter}) => ({
        sourceId: oscillators[sourceSlot - 1].id,
        targetId: oscillators[targetSlot - 1].id,
        parameter,
        signal: 'waveform',
        enabled: true,
        depth: expect.any(Number)
      })));
      for (const route of oscillatorModulations ?? []) expect(route.depth).toBeGreaterThan(0);
      if (id === 'breathing-reed') expect(oscillators[2].filter.enabled).toBe(true);
    }
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
