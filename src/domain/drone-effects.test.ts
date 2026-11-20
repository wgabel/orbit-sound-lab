import { describe, expect, it } from 'vitest';
import { createDefaultDelaySettings } from './delay';
import { DEFAULT_DRONE_EFFECT_ORDER, DEFAULT_DRONE_EFFECTS, moveDroneEffect, validateDroneEffects } from './drone-effects';
import { createDefaultDroneLayer } from './drone-layers';
import { createPatchModule, readPatchDroneLayer, setPatchDroneLayer, validatePatch } from '@domain/patch';
import { createPreset, loadPresetSound, validatePreset } from './preset-library';
import { sceneFromPreset } from './sound-scene';

describe('drone effects', () => {
  it('retains legacy EQ, reverb and master delay settings on import', () => {
    const layer = createDefaultDroneLayer('A');
    const mix = {...layer.drone.mix,lowShelf:{frequencyHz:180,gainDecibels:4},reverb:{enabled:true,mix:0.35}};
    const delay = {...createDefaultDelaySettings(),enabled:true};
    const preset = createPreset('Legacy effects',{...layer.drone,mix},layer.modulation,delay);
    const restored = validatePreset(JSON.parse(JSON.stringify(preset)));
    expect(restored.drone.mix).toEqual(mix);
    expect(restored.drone.mix.effects).toBeUndefined();
    expect(restored.delay).toEqual(delay);
  });

  it('restores an independent chain on the saved layer and in a Drone node', () => {
    const primary = createDefaultDroneLayer('A');
    const secondary = createDefaultDroneLayer('B');
    const effects = {...DEFAULT_DRONE_EFFECTS,eqEnabled:false,
      order:moveDroneEffect(DEFAULT_DRONE_EFFECT_ORDER,5,-1),
      chorus:{...DEFAULT_DRONE_EFFECTS.chorus,enabled:true,rateHz:0.7},
      delay:{...DEFAULT_DRONE_EFFECTS.delay,enabled:true,timeSeconds:0.2}};
    const edited = {...secondary,drone:{...secondary.drone,mix:{...secondary.drone.mix,effects}}};
    const preset = createPreset('Stereo chorus',primary.drone,primary.modulation,createDefaultDelaySettings(),
      primary.harmony,{firstLayerEnabled:true,secondLayer:edited,masterGain:1},'B');
    const restored = validatePreset(JSON.parse(JSON.stringify(preset)));
    expect(sceneFromPreset(restored).layers.B.drone.mix.effects).toEqual(effects);
    expect(sceneFromPreset(restored).layers.A.drone.mix.effects).toBeUndefined();
    expect(restored.delay.enabled).toBe(false);
    const node = createPatchModule('drone','test-drone');
    if (node.kind !== 'drone') throw new Error('Expected a Drone node.');
    const saved = setPatchDroneLayer(node,loadPresetSound(restored,primary));
    expect(() => validatePatch({version:1,modules:[saved],cables:[]})).not.toThrow();
    expect(readPatchDroneLayer(saved).drone.mix.effects).toEqual(effects);
  });

  it('moves one effect by one position and keeps the first and last positions bounded', () => {
    const order = DEFAULT_DRONE_EFFECT_ORDER;
    const moved = moveDroneEffect(order,0,1);
    expect(moved.slice(0,3)).toEqual(['overdrive','eq','compressor']);
    expect(moveDroneEffect(moved,1,-1)).toEqual(order);
    expect(moveDroneEffect(order,0,-1)).toBe(order);
    expect(moveDroneEffect(order,order.length - 1,1)).toBe(order);
  });

  it('rejects invalid parameters before building a graph', () => {
    expect(() => validateDroneEffects(DEFAULT_DRONE_EFFECTS)).not.toThrow();
    expect(() => validateDroneEffects({...DEFAULT_DRONE_EFFECTS,
      flanger:{...DEFAULT_DRONE_EFFECTS.flanger,feedback:1}})).toThrow('Invalid drone flanger');
    expect(() => validateDroneEffects({...DEFAULT_DRONE_EFFECTS,
      overdrive:{...DEFAULT_DRONE_EFFECTS.overdrive,driveDecibels:Infinity}})).toThrow('Invalid drone overdrive');
    expect(() => validateDroneEffects({...DEFAULT_DRONE_EFFECTS,
      compressor:{...DEFAULT_DRONE_EFFECTS.compressor,attackMilliseconds:0}})).toThrow('Invalid drone compressor');
  });

  it('rejects incomplete orders and orders with duplicate or unknown effects', () => {
    const order = DEFAULT_DRONE_EFFECT_ORDER;
    expect(() => validateDroneEffects({...DEFAULT_DRONE_EFFECTS,order:order.slice(1)})).toThrow('Drone effect order');
    expect(() => validateDroneEffects({...DEFAULT_DRONE_EFFECTS,order:['reverb',...order.slice(1)]})).toThrow('Drone effect order');
    expect(() => validateDroneEffects({...DEFAULT_DRONE_EFFECTS,
      order:JSON.parse(JSON.stringify(['unknown',...order.slice(1)]))})).toThrow('Drone effect order');
  });
});
