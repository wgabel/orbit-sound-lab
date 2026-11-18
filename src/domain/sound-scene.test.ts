import { describe, expect, it } from 'vitest';
import { createDefaultDelaySettings } from './delay';
import { createDefaultDroneLayer } from './drone-layers';
import { createPreset } from './preset-library';
import { getArrangementDuration, sceneBlendGains, sceneFromPreset, validateArrangement } from './sound-scene';

describe('sound scenes', () => {
  const first = createDefaultDroneLayer('A');
  const second = {...createDefaultDroneLayer('B'), enabled: true};
  const harmony = {...first.harmony, mode: 'natural' as const, rootFrequencyHz: 90};
  const preset = createPreset('Scene', first.drone, first.modulation, createDefaultDelaySettings(), harmony,
    {firstLayerEnabled: false, secondLayer: second, masterGain: 0.4}, 'B');
  const sound = sceneFromPreset(preset);

  it('reconstructs both layers and the shared effects from a saved preset', () => {
    expect(sound.layers.A).toEqual({...first, harmony, enabled: false});
    expect(sound.layers.B).toEqual(second);
    expect(sound.masterGain).toBe(0.4);
    expect(sound.delay).toEqual(preset.delay);
  });

  it('blends continuously across the midpoint and reaches both exact endpoints', () => {
    expect(sceneBlendGains(0)).toEqual([1, 0]);
    expect(sceneBlendGains(0.49)).toEqual([0.51, 0.49]);
    expect(sceneBlendGains(0.5)).toEqual([0.5, 0.5]);
    expect(sceneBlendGains(0.51)).toEqual([0.49, 0.51]);
    expect(sceneBlendGains(1)).toEqual([0, 1]);
    expect(() => sceneBlendGains(NaN)).toThrow();
  });

  it('counts holds, outgoing blends and opening and ending fades', () => {
    const scenes = [{sound, holdSeconds: 10, blendSeconds: 30}, {sound, holdSeconds: 45, blendSeconds: 60}];
    expect(getArrangementDuration([])).toBe(0);
    expect(getArrangementDuration(scenes)).toBe(100);
    expect(() => validateArrangement(scenes)).not.toThrow();
    expect(() => validateArrangement([{...scenes[0], holdSeconds: -1}])).toThrow();
  });
});
