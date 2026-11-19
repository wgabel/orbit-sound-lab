import { describe, expect, it } from 'vitest';
import { createDefaultDroneLayer } from './drone-layers';
import { createExamplePatch, createPatchModule, setPatchDroneLayer } from './patch';
import { readPatchPreset } from './patch-preset';

function createPresetFixture() {
  const example = createExamplePatch();
  const drone = example.modules[0];
  if (drone.kind !== 'drone') throw new Error('Expected a Drone node.');
  const patch = {...example,modules:[setPatchDroneLayer(drone,createDefaultDroneLayer('B'),'B'),
    ...example.modules.slice(1),createPatchModule('lfo','module-1'),createPatchModule('oscilloscope','module-2')]};
  const layout = Object.fromEntries(patch.modules.map((module,index) => [module.id,{x:25+index*173,y:99+index*13}]));
  return {kind:'orbit-patch',schemaVersion:1,id:'patch',name:' Whole patch ',createdAt:'2026-11-19T10:00:00.000Z',
    patch,layout,viewport:{x:100,y:30}};
}

describe('whole patch preset files', () => {
  it('round-trips nodes, nested settings, cables, layout and viewport as a detached snapshot', () => {
    const fixture = createPresetFixture();
    const preset = readPatchPreset(fixture);
    expect(preset).toEqual({...fixture,name:'Whole patch'});
    expect(preset.patch.modules[0].settings).not.toBe(fixture.patch.modules[0].settings);
    expect(readPatchPreset(JSON.parse(JSON.stringify(preset)))).toEqual(preset);
  });

  it('preserves optional automation cable controls and rejects invalid flags', () => {
    const fixture = createPresetFixture();
    const cable = fixture.patch.cables.find(item => item.mapping);
    if (!cable) throw new Error('Expected a control cable.');
    const edited = {...cable,inverted:true,enabled:false};
    const preset = readPatchPreset({...fixture,patch:{...fixture.patch,cables:[edited]}});
    expect(readPatchPreset(JSON.parse(JSON.stringify(preset))).patch.cables).toEqual([edited]);
    expect(() => readPatchPreset({...fixture,patch:{...fixture.patch,
      cables:[{...edited,enabled:'false'}]}})).toThrow('automation cable controls');
    expect(() => readPatchPreset({...fixture,patch:{...fixture.patch,
      cables:[{...fixture.patch.cables[0],inverted:true}]}})).toThrow('automation cable controls');
  });

  it('validates supported module kinds, cable compatibility and every node position', () => {
    const fixture = createPresetFixture();
    const invalidCable = {...fixture.patch.cables[0],destination:{moduleId:'missing',portId:'in'}};
    expect(() => readPatchPreset({...fixture,patch:{...fixture.patch,cables:[invalidCable]}})).toThrow('compatible');
    expect(() => readPatchPreset({...fixture,patch:{...fixture.patch,
      modules:[{...fixture.patch.modules[0],kind:'future'}]}})).toThrow('Invalid patch module');
    expect(() => readPatchPreset({...fixture,layout:{...fixture.layout,'module-1':{x:-10,y:50}}})).toThrow('Invalid patch layout');
    expect(() => readPatchPreset({...fixture,kind:'orbit-automation'})).toThrow('Patch preset JSON');
  });
});
