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
