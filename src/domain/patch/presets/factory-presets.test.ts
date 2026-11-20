import { describe, expect, it } from 'vitest';
import { FACTORY_PATCH_GROUPS } from '@domain/patch/presets/factory-presets';
import { readPatchPreset } from '@domain/patch/presets/model';

describe('factory patch presets', () => {
  const presets = FACTORY_PATCH_GROUPS.flatMap(group => group.presets);

  it('provides uniquely named patches in five groups', () => {
    expect(FACTORY_PATCH_GROUPS.map(group => group.presets.length)).toEqual([3,4,3,4,1]);
    expect(new Set(presets.map(preset => preset.id)).size).toBe(15);
    expect(new Set(presets.map(preset => preset.name)).size).toBe(15);
  });

  it('provides wet Drone sources and audible modulation routes in every heavy preset', () => {
    const heavy = FACTORY_PATCH_GROUPS.find(group => group.label === 'Heavy & Wet Drones');
    expect(heavy?.presets).toHaveLength(4);
    for (const {patch} of heavy?.presets ?? []) {
      const drones = patch.modules.filter(module => module.kind === 'drone');
      expect(drones.some(drone => drone.settings.voice.mix.reverb.enabled && drone.settings.voice.mix.reverb.mix >= 0.6)).toBe(true);
      expect(drones.some(drone => drone.settings.voice.oscillatorModulations?.length)).toBe(true);
      expect(patch.cables.filter(cable => cable.mapping && cable.mapping.from !== cable.mapping.to).length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(presets)('loads and can be saved with every module connected in $name', preset => {
    expect(() => readPatchPreset({...preset,kind:'orbit-patch',schemaVersion:1,
      createdAt:'2026-11-19T10:00:00.000Z'})).not.toThrow();
    expect(preset.patch.modules.filter(module => module.kind === 'output')).toHaveLength(1);
    const audioInputs = preset.patch.cables.filter(cable => cable.destination.moduleId === 'output' && !cable.mapping);
    expect(audioInputs).toHaveLength(1);

    const reachable = new Set(['output']);
    function visitInputs(id: string): void {
      for (const cable of preset.patch.cables) {
        if (cable.destination.moduleId !== id || reachable.has(cable.source.moduleId)) continue;
        reachable.add(cable.source.moduleId);
        visitInputs(cable.source.moduleId);
      }
    }
    visitInputs('output');
    expect(reachable.size).toBe(preset.patch.modules.length);
  });
});
