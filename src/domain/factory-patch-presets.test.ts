import { describe, expect, it } from 'vitest';
import { FACTORY_PATCH_GROUPS } from './factory-patch-presets';
import { readPatchPreset } from './patch-preset';

describe('factory patch presets', () => {
  const presets = FACTORY_PATCH_GROUPS.flatMap(group => group.presets);

  it('provides uniquely named patches in four groups', () => {
    expect(FACTORY_PATCH_GROUPS.map(group => group.presets.length)).toEqual([3,4,3,1]);
    expect(new Set(presets.map(preset => preset.id)).size).toBe(11);
    expect(new Set(presets.map(preset => preset.name)).size).toBe(11);
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
