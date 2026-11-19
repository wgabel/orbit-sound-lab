import { describe, expect, it } from 'vitest';
import { connectPatchPorts, createExamplePatch, createPatchModule, getPatchModuleLabel, readPatchDroneLayer, setPatchDroneLayer, validatePatch } from './patch';
import type { Patch } from './patch';
import { readAutomationPhase, readAutomationValue } from './patch-automation';
import { createDefaultDroneLayer } from './drone-layers';
import { tuneSceneLayer } from './sound-scene';
import { createDefaultDelaySettings } from './delay';
import { createPreset, loadPresetSound, validatePreset } from './preset-library';

describe('copied drone nodes', () => {
  it('captures tuned settings and LFOs independently of the source layer and keeps its cable endpoint', () => {
    const original = createDefaultDroneLayer('B');
    const source = {...original, harmony:{...original.harmony, mode:'natural' as const, rootFrequencyHz:125},
      modulation:original.modulation.map((settings,index) => index === 0 ? {...settings, enabled:true} : settings)};
    const node = createPatchModule('drone','existing');
    if (node.kind !== 'drone') throw new Error('Expected a Drone node.');
    const snapshot = setPatchDroneLayer(node,source,'B');
    expect(snapshot.id).toBe(node.id);
    expect(getPatchModuleLabel(snapshot)).toBe('Drone B');
    expect(snapshot.settings.voice.oscillators[0].frequencyHz).toBe(220);
    expect(tuneSceneLayer(readPatchDroneLayer(snapshot)).oscillators[0].frequencyHz).toBe(250);
    expect(snapshot.settings.harmony).toEqual(source.harmony);
    expect(snapshot.settings.harmony).not.toBe(source.harmony);
    expect(source.drone.oscillators[0].frequencyHz).toBe(220);
    expect(snapshot.settings.voice.mix).toEqual(source.drone.mix);
    expect(snapshot.settings.voice.mix).not.toBe(source.drone.mix);
    expect(snapshot.settings.modulation).toEqual(source.modulation);
    expect(snapshot.settings.modulation?.[0]).not.toBe(source.modulation[0]);
    expect(snapshot.settings).not.toHaveProperty('enabled');
    const output = createPatchModule('output','output');
    const connected = connectPatchPorts({version:1, modules:[node,output], cables:[]},'cable',
      {moduleId:node.id,portId:'out'},{moduleId:output.id,portId:'in'});
    expect(() => validatePatch({...connected,modules:[snapshot,output]})).not.toThrow();
  });
  it('loads the saved source layer and saves a standalone drone preset with its original tuning', () => {
    const primary = createDefaultDroneLayer('A');
    const secondary = createDefaultDroneLayer('B');
    const harmony = {...secondary.harmony,mode:'natural' as const,rootFrequencyHz:125};
    const preset = createPreset('Drone B',primary.drone,primary.modulation,createDefaultDelaySettings(),primary.harmony,
      {firstLayerEnabled:true,secondLayer:{...secondary,harmony},masterGain:0.5},'B');
    const node = createPatchModule('drone','preset-drone');
    if (node.kind !== 'drone') throw new Error('Expected a Drone node.');
    const loaded = setPatchDroneLayer(node,loadPresetSound(preset,readPatchDroneLayer(node)));
    const layer = readPatchDroneLayer(loaded);
    expect(layer.drone).toEqual(secondary.drone);
    expect(layer.harmony).toEqual(harmony);
    const saved = createPreset('From node',layer.drone,layer.modulation,createDefaultDelaySettings(),layer.harmony);
    const restored = loadPresetSound(validatePreset(JSON.parse(JSON.stringify(saved))),primary);
    expect(restored).toEqual(layer);
    expect(tuneSceneLayer(restored).oscillators[0].frequencyHz).toBe(250);
  });
});

describe('patch routing', () => {
  it('allows an LFO to drive multiple control inputs and rejects invalid rates', () => {
    const lfo = createPatchModule('lfo','lfo');
    if (lfo.kind !== 'lfo') throw new Error('Expected an LFO module.');
    const source = {moduleId:lfo.id,portId:'control'};
    const patch: Patch = {version:1,modules:[lfo,createPatchModule('gain','gain'),createPatchModule('filter','filter')],cables:[]};
    const first = connectPatchPorts(patch,'level',source,{moduleId:'gain',portId:'level'});
    const second = connectPatchPorts(first,'cutoff',source,{moduleId:'filter',portId:'cutoff'});
    expect(second.cables).toHaveLength(2);
    expect(() => connectPatchPorts(patch,'audio',source,{moduleId:'gain',portId:'in'})).toThrow('compatible');
    expect(() => validatePatch({...patch,modules:[{...lfo,settings:{...lfo.settings,rateHz:21}}]})).toThrow('Invalid LFO');
  });

  it('uses one automation output for two independent destinations', () => {
    const patch = createExamplePatch();
    expect(() => validatePatch(patch)).not.toThrow();
    const routes = patch.cables.filter(cable => cable.source.moduleId === 'automation');
    expect(routes.map(cable => cable.mapping)).toEqual([{from:180,to:2400},{from:0.08,to:0.7}]);
    expect(JSON.parse(JSON.stringify(patch))).toEqual(patch);
  });

  it('rejects feedback and incompatible or occupied inputs without touching the original patch', () => {
    const patch: Patch = {version:1, modules:[
      createPatchModule('filter','filter'), createPatchModule('gain','gain'), createPatchModule('automation','automation')
    ], cables:[]};
    const next = connectPatchPorts(patch,'filter-gain',{moduleId:'filter',portId:'out'},{moduleId:'gain',portId:'in'});
    expect(() => connectPatchPorts(next,'loop',{moduleId:'gain',portId:'out'},{moduleId:'filter',portId:'in'})).toThrow('feedback loop');
    expect(() => connectPatchPorts(next,'kind',{moduleId:'automation',portId:'control'},{moduleId:'filter',portId:'in'})).toThrow('compatible');
    expect(() => connectPatchPorts(next,'duplicate',{moduleId:'filter',portId:'out'},{moduleId:'gain',portId:'in'})).toThrow('already has a cable');
    expect(next.cables).toHaveLength(1);
    expect(patch.cables).toHaveLength(0);
  });

  it('combines two audio inputs and gives each mixer channel its own control input', () => {
    let patch: Patch = {version:1, modules:[
      createPatchModule('wave','first'), createPatchModule('wave','second'),
      createPatchModule('mixer','mixer'), createPatchModule('output','output'),
      createPatchModule('automation','automation')
    ], cables:[]};
    patch = connectPatchPorts(patch,'audio-a',{moduleId:'first',portId:'out'},{moduleId:'mixer',portId:'inputA'});
    patch = connectPatchPorts(patch,'audio-b',{moduleId:'second',portId:'out'},{moduleId:'mixer',portId:'inputB'});
    patch = connectPatchPorts(patch,'mix-out',{moduleId:'mixer',portId:'out'},{moduleId:'output',portId:'in'});
    const control = {moduleId:'automation',portId:'control'};
    patch = connectPatchPorts(patch,'level-a',control,{moduleId:'mixer',portId:'levelA'});
    patch = connectPatchPorts(patch,'level-b',control,{moduleId:'mixer',portId:'levelB'});
    expect(patch.cables.slice(-2).map(cable => cable.mapping)).toEqual([{from:0,to:1},{from:0,to:1}]);
    expect(() => validatePatch(patch)).not.toThrow();
    expect(() => connectPatchPorts(patch,'duplicate',{moduleId:'second',portId:'out'},
      {moduleId:'mixer',portId:'inputA'})).toThrow('already has a cable');
    expect(() => connectPatchPorts({...patch,cables:[]},'wrong-type',control,
      {moduleId:'mixer',portId:'inputB'})).toThrow('compatible');
  });
});

describe('patch automation', () => {
  it('holds steps, supports glides, and uses the shared elapsed time for loop and once', () => {
    const node = createPatchModule('automation','automation');
    if (node.kind !== 'automation') throw new Error('Wrong module kind.');
    const settings = node.settings;
    expect(readAutomationValue(settings,readAutomationPhase(settings,1.5))).toBe(0.75);
    expect(readAutomationValue({...settings,glide:0.5},0.09375)).toBe(0.375);
    expect(readAutomationPhase(settings,9.5)).toBe(0.1875);
    expect(readAutomationPhase({...settings,mode:'once'},9.5)).toBe(1);
    expect(readAutomationValue({...settings,mode:'once'},1)).toBe(0.87);
  });

  it('interpolates a curve and samples LFO shapes', () => {
    const node = createPatchModule('automation','automation');
    if (node.kind !== 'automation') throw new Error('Wrong module kind.');
    expect(readAutomationValue({...node.settings,shape:'curve'},0.0625)).toBe(0.375);
    expect(readAutomationValue({...node.settings,shape:'square'},0.5)).toBe(1);
    expect(readAutomationValue({...node.settings,shape:'sine'},0.5)).toBe(1);
  });
});

describe('Shelf EQ routing', () => {
  it('accepts audio and separate frequency and gain controls on Shelf EQ', () => {
    const shelf = createPatchModule('shelfEq','shelf');
    if (shelf.kind !== 'shelfEq') throw new Error('Expected a Shelf EQ module.');
    let patch: Patch = {version:1,modules:[
      createPatchModule('wave','wave'), shelf, createPatchModule('output','output'),
      createPatchModule('automation','automation')
    ],cables:[]};
    patch = connectPatchPorts(patch,'audio-in',{moduleId:'wave',portId:'out'},{moduleId:'shelf',portId:'in'});
    patch = connectPatchPorts(patch,'audio-out',{moduleId:'shelf',portId:'out'},{moduleId:'output',portId:'in'});
    for (const portId of ['lowFrequency','lowGain','highFrequency','highGain']) {
      patch = connectPatchPorts(patch,portId,{moduleId:'automation',portId:'control'},{moduleId:'shelf',portId});
    }
    expect(patch.cables.slice(2).map(cable => cable.mapping)).toEqual([
      {from:20,to:20000}, {from:-12,to:12}, {from:20,to:20000}, {from:-12,to:12}
    ]);
    expect(() => validatePatch({...patch,modules:[{...shelf,settings:{...shelf.settings,
      highShelf:{...shelf.settings.highShelf,gainDecibels:13}}}],cables:[]})).toThrow('Shelf gain');
  });
});

describe('oscilloscope routing', () => {
  it('allows an inline connection and a monitoring branch from the same audio source', () => {
    let patch: Patch = {version:1,modules:[
      createPatchModule('gain','gain'), createPatchModule('oscilloscope','inline'),
      createPatchModule('oscilloscope','tap'), createPatchModule('output','output')
    ],cables:[]};
    const gain = {moduleId:'gain',portId:'out'};
    patch = connectPatchPorts(patch,'to-inline',gain,{moduleId:'inline',portId:'in'});
    patch = connectPatchPorts(patch,'to-output',{moduleId:'inline',portId:'out'},{moduleId:'output',portId:'in'});
    patch = connectPatchPorts(patch,'to-tap',gain,{moduleId:'tap',portId:'in'});
    expect(patch.cables.every(cable => cable.mapping === undefined)).toBe(true);
    expect(() => connectPatchPorts(patch,'feedback',{moduleId:'inline',portId:'out'},
      {moduleId:'gain',portId:'in'})).toThrow('feedback loop');
    expect(() => connectPatchPorts(patch,'control',{moduleId:'tap',portId:'out'},
      {moduleId:'gain',portId:'level'})).toThrow('compatible');
  });
});

describe('Pitch Shift patch module', () => {
  it('connects between a drone and output and survives JSON serialization', () => {
    const drone = createPatchModule('drone','drone');
    const pitch = createPatchModule('pitchShift','pitch');
    const output = createPatchModule('output','output');
    const initial: Patch = {version:1,modules:[drone,pitch,output],cables:[]};
    const connected = connectPatchPorts(connectPatchPorts(initial,'a',
      {moduleId:'drone',portId:'out'},{moduleId:'pitch',portId:'in'}),'b',
      {moduleId:'pitch',portId:'out'},{moduleId:'output',portId:'in'});
    expect(() => validatePatch(JSON.parse(JSON.stringify(connected)))).not.toThrow();
    expect(getPatchModuleLabel(pitch)).toBe('Pitch Shift');
  });

  it('accepts a semitone mapping from Automation or LFO and rejects invalid endpoints', () => {
    const pitch = createPatchModule('pitchShift','pitch');
    for (const kind of ['automation','lfo'] as const) {
      const source = createPatchModule(kind,'source');
      const connected = connectPatchPorts({version:1,modules:[source,pitch],cables:[]},'sweep',
        {moduleId:source.id,portId:'control'},{moduleId:pitch.id,portId:'semitones'});
      expect(connected.cables[0].mapping).toEqual({from:-24,to:24});
      expect(() => validatePatch({...connected,cables:[{...connected.cables[0],mapping:{from:-25,to:12}}]})).toThrow('Pitch mapping');
    }
  });

  it('rejects out-of-range tuning', () => {
    const pitch = createPatchModule('pitchShift','pitch');
    if (pitch.kind !== 'pitchShift') throw new Error('Expected Pitch Shift.');
    for (const settings of [{semitones:25,cents:0},{semitones:0,cents:-101},
      {semitones:NaN,cents:0}]) {
      expect(() => validatePatch({version:1,modules:[{...pitch,settings}],cables:[]})).toThrow('Pitch Shift');
    }
  });
});
