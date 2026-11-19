import { describe, expect, it } from 'vitest';
import { readAutomationPreset } from './automation-preset';
import { applyHarmonicsPreset } from './patch-harmonics';

const automation = applyHarmonicsPreset({duration:3,mode:'once',shape:'steps',glide:0,
  points:[{position:0,value:0},{position:1,value:1}]},'dorian');
const preset = {kind:'orbit-automation',schemaVersion:1,id:'saved',name:' Dorian ',createdAt:'2026-11-19T09:00:00.000Z',automation};

describe('Automation preset files', () => {
  it('round-trips all Automation settings as a detached snapshot', () => {
    const snapshot = readAutomationPreset(preset);
    expect(snapshot.name).toBe('Dorian');
    expect(snapshot.automation).toEqual(automation);
    expect(snapshot.automation.points[0]).not.toBe(automation.points[0]);
    expect(readAutomationPreset(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it('rejects drone files, unknown versions, and invalid Automation data', () => {
    expect(() => readAutomationPreset({schemaVersion:1,drone:{}})).toThrow('Automation preset');
    expect(() => readAutomationPreset({...preset,schemaVersion:2})).toThrow('Automation preset');
    expect(() => readAutomationPreset({...preset,automation:{...automation,points:[null,null]}})).toThrow('Invalid automation point');
    expect(() => readAutomationPreset({...preset,automation:{...automation,duration:0}})).toThrow('duration');
    expect(() => readAutomationPreset({...preset,name:'   '})).toThrow('preset name');
  });
});
