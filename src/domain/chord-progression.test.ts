import { describe, expect, it } from 'vitest';
import { DEFAULT_CHORD_SETTINGS, getChordMidiNotes } from './chord';
import { DEFAULT_CHORD_PROGRESSION, validateChordProgression, voiceProgressionStep } from './chord-progression';
import { readPatchArrangement } from '@domain/patch/arrangement';
import { connectPatchPorts, createPatchModule } from '@domain/patch';
import { readPatchPreset } from '@domain/patch/presets/model';

describe('Chord Progression', () => {
  const progression = createPatchModule('chordProgression','progression');
  const generator = createPatchModule('chord','generator');
  const automation = createPatchModule('automation','automation');
  const modules = [progression,generator,automation];
  const chords = {moduleId:progression.id,portId:'chords'};
  const input = {moduleId:generator.id,portId:'chords'};
  const patch = connectPatchPorts({version:1,modules,cables:[]},'chords',chords,input);

  it('uses typed chord cables and preserves them and progression clips in a saved patch', () => {
    const arrangement = readPatchArrangement({tail:0,sections:[],clips:[
      {id:'clip',moduleId:progression.id,start:0,duration:8,fadeIn:0,fadeOut:0,level:1,phase:'continue'}
    ]},patch);
    const layout = Object.fromEntries(modules.map(module => [module.id,{x:20,y:20}]));
    const preset = readPatchPreset({kind:'orbit-patch',schemaVersion:1,id:'preset',name:'Chords',
      createdAt:'2026-11-19T10:00:00Z',patch,layout,viewport:{x:0,y:0},arrangement});
    expect(readPatchPreset(JSON.parse(JSON.stringify(preset)))).toEqual(preset);
    expect(preset.patch.cables[0].mapping).toBeUndefined();
    expect(() => connectPatchPorts({...patch,cables:[]},'wrong',
      {moduleId:automation.id,portId:'control'},input)).toThrow('compatible input');
  });

  it('retains generator voicing and clamps an inversion when the new chord has fewer notes', () => {
    const settings = {...DEFAULT_CHORD_SETTINGS,chord:'minor9' as const,inversion:4,octave:-1};
    const step = voiceProgressionStep(settings,{rootNote:60,chord:'major'});
    expect(step).toMatchObject({rootNote:60,chord:'major',inversion:2,octave:-1});
    expect(getChordMidiNotes(step)).toEqual([55,60,64]);
  });

  it('validates step length, pitch, and quality', () => {
    expect(() => validateChordProgression({...DEFAULT_CHORD_PROGRESSION,stepSeconds:0})).toThrow();
    expect(() => validateChordProgression({...DEFAULT_CHORD_PROGRESSION,steps:[{rootNote:73,chord:'major'}]})).toThrow();
    expect(() => validateChordProgression({...DEFAULT_CHORD_PROGRESSION,steps:[]})).toThrow();
  });
});
