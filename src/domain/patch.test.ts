import { describe, expect, it } from 'vitest';
import { connectPatchPorts, createExamplePatch, createPatchModule, validatePatch } from './patch';
import type { Patch } from './patch';
import { readAutomationPhase, readAutomationValue } from './patch-automation';

describe('patch routing', () => {
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
