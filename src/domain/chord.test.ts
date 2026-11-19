import {describe,expect,it} from 'vitest';
import {DEFAULT_CHORD_SETTINGS,getChordFrequencies,getChordMidiNotes,getMaximumChordInversion,validateChordSettings} from './chord';
import {connectPatchPorts,createPatchModule,validatePatch} from './patch';

describe('Chord Generator',()=>{
  it('generates equal-tempered C major triad',()=>{
    expect(getChordMidiNotes({...DEFAULT_CHORD_SETTINGS,rootNote:60})).toEqual([60,64,67]);
    expect(getChordFrequencies({...DEFAULT_CHORD_SETTINGS,rootNote:69})[0]).toBeCloseTo(440,5);
  });
  it('supports inversions, extensions and voicing spread',()=>{
    expect(getChordMidiNotes({...DEFAULT_CHORD_SETTINGS,rootNote:60,inversion:1})).toEqual([64,67,72]);
    expect(getChordMidiNotes({...DEFAULT_CHORD_SETTINGS,rootNote:60,chord:'minor7'})).toEqual([60,63,67,70]);
    expect(getChordMidiNotes({...DEFAULT_CHORD_SETTINGS,rootNote:60,spread:1})).toEqual([60,76,91]);
  });
  it('supports only inversions with an available bass note',()=>{
    expect(getMaximumChordInversion('major')).toBe(2);
    expect(getMaximumChordInversion('dominant7')).toBe(3);
    expect(getMaximumChordInversion('minor9')).toBe(4);
    expect(()=>getChordMidiNotes({...DEFAULT_CHORD_SETTINGS,inversion:3})).toThrow();
    expect(getChordMidiNotes({...DEFAULT_CHORD_SETTINGS,chord:'minor9',inversion:4})).toEqual([62,63,67,70,72]);
  });
  it('rejects invalid tuning and chord quality',()=>{
    expect(()=>validateChordSettings({...DEFAULT_CHORD_SETTINGS,rootNote:90})).toThrow();
    expect(()=>validateChordSettings({...DEFAULT_CHORD_SETTINGS,spread:2})).toThrow();
  });
  it('connects to Output and round-trips through JSON',()=>{
    const chord=createPatchModule('chord','chord');
    const output=createPatchModule('output','output');
    const patch=connectPatchPorts({version:1,modules:[chord,output],cables:[]},'cable',
      {moduleId:'chord',portId:'out'},{moduleId:'output',portId:'in'});
    expect(()=>validatePatch(JSON.parse(JSON.stringify(patch)))).not.toThrow();
  });
});
