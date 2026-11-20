import { describe, expect, it } from 'vitest';
import { createDefaultDroneLayer } from '@domain/drone-layers';
import { connectPatchPorts, createExamplePatch, createPatchModule, setPatchDroneLayer } from '@domain/patch';
import { DEFAULT_CHORD_SETTINGS } from '@domain/chord';
import { readPatchPreset } from '@domain/patch/presets/model';

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

  it('round-trips negative node and viewport positions', () => {
    const fixture = createPresetFixture();
    const layout = {...fixture.layout,drone:{x:-210,y:-80}};
    const viewport = {x:-420,y:-180};
    const preset = readPatchPreset({...fixture,layout,viewport});
    expect(readPatchPreset(JSON.parse(JSON.stringify(preset)))).toMatchObject({layout,viewport});
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

  it('preserves the sound of older triad presets saved with the wrapped inversion', () => {
    const fixture = createPresetFixture();
    const triad = {id:'triad',kind:'chord',settings:{...DEFAULT_CHORD_SETTINGS,inversion:3}};
    const seventh = {id:'seventh',kind:'chord',settings:{...DEFAULT_CHORD_SETTINGS,chord:'major7',inversion:3}};
    const preset = readPatchPreset({...fixture,patch:{version:1,modules:[triad,seventh],cables:[]},
      layout:{triad:{x:0,y:0},seventh:{x:180,y:0}}});
    expect(preset.patch.modules).toEqual([{...triad,settings:{...triad.settings,inversion:0}},seventh]);
    expect(triad.settings.inversion).toBe(3);
  });

  it('round-trips both Crossfader audio inputs and its full-range Blend control', () => {
    const first = createPatchModule('wave','first');
    const second = createPatchModule('wave','second');
    const crossfader = createPatchModule('crossfader','crossfader');
    const automation = createPatchModule('automation','automation');
    const modules = [first,second,crossfader,automation];
    const withAudioA = connectPatchPorts({version:1,modules,cables:[]},'first',
      {moduleId:first.id,portId:'out'},{moduleId:crossfader.id,portId:'inputA'});
    const withBothInputs = connectPatchPorts(withAudioA,'second',
      {moduleId:second.id,portId:'out'},{moduleId:crossfader.id,portId:'inputB'});
    const patch = connectPatchPorts(withBothInputs,'blend',
      {moduleId:automation.id,portId:'control'},{moduleId:crossfader.id,portId:'blend'});
    const layout = Object.fromEntries(modules.map(module => [module.id,{x:30,y:30}]));
    const preset = readPatchPreset({...createPresetFixture(),patch,layout});
    expect(preset.patch.modules[2].settings).toEqual({blend:0.5});
    expect(preset.patch.cables[2].mapping).toEqual({from:0,to:1});
    expect(readPatchPreset(JSON.parse(JSON.stringify(preset)))).toEqual(preset);
    expect(() => readPatchPreset({...preset,patch:{...patch,modules:[
      first,second,{...crossfader,settings:{blend:1.1}},automation
    ]}})).toThrow('Blend');
  });

  it('validates supported module kinds, cable compatibility and every node position', () => {
    const fixture = createPresetFixture();
    const invalidCable = {...fixture.patch.cables[0],destination:{moduleId:'missing',portId:'in'}};
    expect(() => readPatchPreset({...fixture,patch:{...fixture.patch,cables:[invalidCable]}})).toThrow('compatible');
    expect(() => readPatchPreset({...fixture,patch:{...fixture.patch,
      modules:[{...fixture.patch.modules[0],kind:'future'}]}})).toThrow('Invalid patch module');
    expect(() => readPatchPreset({...fixture,layout:{...fixture.layout,'module-1':{x:-10000,y:50}}})).toThrow('Invalid patch layout');
    expect(() => readPatchPreset({...fixture,kind:'orbit-automation'})).toThrow('Patch preset JSON');
  });
});
