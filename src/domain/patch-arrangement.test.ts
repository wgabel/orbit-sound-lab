import { describe, expect, it } from 'vitest';
import { ARRANGEMENT_DEMO } from './arrangement-demo';
import { duplicateArrangementSection, readArrangementEnd, readClipElapsed, readPatchArrangement } from './patch-arrangement';
import { readPatchPreset } from './patch-preset';

describe('patch arrangements', () => {
  const {patch,arrangement} = ARRANGEMENT_DEMO;
  const first = arrangement.clips[0];

  it('preserves the full factory arrangement across a preset JSON round trip', () => {
    const seed = {...ARRANGEMENT_DEMO,kind:'orbit-patch',schemaVersion:1,createdAt:'2026-11-19T10:00:00Z'};
    const saved = readPatchPreset(seed);
    expect(saved.arrangement).toEqual(arrangement);
    expect(readArrangementEnd(arrangement) + arrangement.tail).toBe(90);
    expect(readPatchPreset(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(readPatchPreset({...seed,arrangement:undefined}).arrangement).toBeUndefined();
  });

  it('copies clips within a section and leaves a sustained clip spanning the section alone', () => {
    let id = 0;
    const next = duplicateArrangementSection(arrangement,arrangement.sections[1],() => `copy-${++id}`);
    const validated = readPatchArrangement(next,patch);
    expect(validated.sections.at(-1)).toMatchObject({name:'A · Gesture′',start:88,duration:20});
    expect(validated.clips.filter(clip => clip.start === 88).map(clip => clip.moduleId)).toEqual(['melody','phrase','rests']);
    expect(validated.clips.filter(clip => clip.moduleId === first.moduleId)).toEqual([first]);
  });

  it('uses local elapsed time for restarted curves and piece time for synchronized ones', () => {
    expect(readClipElapsed({...first,start:8},9.5)).toBe(1.5);
    expect(readClipElapsed({...first,start:8,phase:'continue'},9.5)).toBe(9.5);
  });

  it('rejects overlapping clips on a track, invalid automation targets and clips made for a missing node', () => {
    expect(() => readPatchArrangement({...arrangement,clips:[first,{...first,id:'new'}]},patch)).toThrow('same track');
    expect(() => readPatchArrangement({...arrangement,clips:[{...first,phase:'restart'}]},patch)).toThrow('Automation node');
    expect(() => readPatchArrangement({...arrangement,clips:[{...first,moduleId:'missing'}]},patch)).toThrow('Choose a Wave');
    expect(() => readPatchArrangement({...arrangement,clips:[{...first,fadeIn:first.duration}]},patch)).toThrow('fades');
  });
});
