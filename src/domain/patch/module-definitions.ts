import { DEFAULT_CHORD_SETTINGS, validateChordSettings } from '@domain/chord';
import { DEFAULT_CHORD_PROGRESSION, validateChordProgression } from '@domain/chord-progression';
import { validateCycleEnvelope } from '@domain/cycle-envelope';
import { createDefaultDroneSettings, createDefaultShelfEq, MAX_SHELF_FREQUENCY_HZ,
  MAX_SHELF_GAIN_DECIBELS, MIN_SHELF_FREQUENCY_HZ, OSCILLATOR_WAVEFORMS,
  supportsOscillatorShape, validateDroneSettings, validateShelfEq } from '@domain/drone';
import { validateHarmonySettings } from '@domain/harmony';
import { DEFAULT_REVERB, validateReverb } from '@domain/reverb';
import { DEFAULT_SIMPLEX_NOISE, validateSimplexNoise } from '@domain/simplex-noise';
import { MAXIMUM_AUTOMATION_DURATION, MAXIMUM_AUTOMATION_STEPS,
  MINIMUM_AUTOMATION_DURATION, validateAutomation } from './automation';
import { DEFAULT_PATCH_LFO, validatePatchLfo } from './lfo';
import type { PatchModule, PatchModuleKind, PatchPort } from './model';

export type PatchModuleCategory = 'source' | 'control' | 'processor';

/** Domain-owned metadata and behavior required to add a module kind to a patch. */
export interface PatchModuleDefinition {
  readonly label: string;
  readonly category: PatchModuleCategory;
  create(id: string): PatchModule;
  ports(module: PatchModule): readonly PatchPort[];
  validate(module: PatchModule): void;
}

const audioInput: PatchPort = {id:'in',label:'Audio in',direction:'input',signal:'audio'};
const audioOutput: PatchPort = {id:'out',label:'Audio out',direction:'output',signal:'audio'};
const level: PatchPort = {id:'level',label:'Level',direction:'input',signal:'control',
  parameter:{unit:'%',minimum:0,maximum:1,displayScale:100}};
const shape: PatchPort = {id:'shape',label:'Shape',direction:'input',signal:'control',
  parameter:{unit:'%',minimum:0,maximum:1,displayScale:100}};
const shelfFrequency = {unit:'Hz',minimum:MIN_SHELF_FREQUENCY_HZ,maximum:MAX_SHELF_FREQUENCY_HZ};
const shelfGain = {unit:'dB',minimum:-MAX_SHELF_GAIN_DECIBELS,maximum:MAX_SHELF_GAIN_DECIBELS};

function noValidation(): void {}

function within(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function requireRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!within(value, minimum, maximum)) throw new Error(`${label} is outside its supported range.`);
}

export const PATCH_MODULE_DEFINITIONS = {
  chord: {
    label:'Chord Generator',category:'source',
    create:id => ({id,kind:'chord',settings:{...DEFAULT_CHORD_SETTINGS}}),
    ports:() => [{id:'chords',label:'Chords',direction:'input',signal:'chords'},audioOutput],
    validate:module => {if (module.kind === 'chord') validateChordSettings(module.settings);}
  },
  chordProgression: {
    label:'Chord Progression',category:'control',
    create:id => ({id,kind:'chordProgression',settings:structuredClone(DEFAULT_CHORD_PROGRESSION)}),
    ports:() => [{id:'chords',label:'Chords',direction:'output',signal:'chords'}],
    validate:module => {if (module.kind === 'chordProgression') validateChordProgression(module.settings);}
  },
  wave: {
    label:'Wave',category:'source',
    create:id => ({id,kind:'wave',settings:{waveform:'sine',frequency:110,shape:0.5}}),
    ports:module => module.kind !== 'wave' ? [] : [
      audioOutput,
      {id:'frequency',label:'Frequency',direction:'input',signal:'control',
        parameter:{unit:'Hz',minimum:40,maximum:880}},
      ...(supportsOscillatorShape(module.settings.waveform)
        ? [module.settings.waveform === 'cycleEnvelope' ? {...shape,label:'Amount'} : shape]
        : [])
    ],
    validate:module => {
      if (module.kind !== 'wave') return;
      if (!OSCILLATOR_WAVEFORMS.includes(module.settings.waveform)) throw new Error('Unknown waveform.');
      if (module.settings.cycleEnvelope !== undefined) validateCycleEnvelope(module.settings.cycleEnvelope);
      requireRange(module.settings.frequency, 40, 880, 'Frequency');
      if (supportsOscillatorShape(module.settings.waveform)) requireRange(module.settings.shape, 0, 1, 'Shape');
    }
  },
  drone: {
    label:'Drone',category:'source',
    create:id => ({id,kind:'drone',settings:{voice:createDefaultDroneSettings()}}),
    ports:() => [audioOutput],
    validate:module => {
      if (module.kind !== 'drone') return;
      validateDroneSettings(module.settings.voice);
      if (module.settings.harmony !== undefined) validateHarmonySettings(module.settings.harmony);
    }
  },
  automation: {
    label:'Automation',category:'control',
    create:id => ({id,kind:'automation',settings:{shape:'steps',mode:'loop',duration:8,glide:0,
      points:[0,0.75,0.25,1,0.1,0.58,0.23,0.87,0.87]
        .map((value,index) => ({position:index/8,value}))}}),
    ports:module => module.kind !== 'automation' ? [] : [
      {id:'control',label:'Value',direction:'output',signal:'control'},
      {id:'duration',label:'Duration',direction:'input',signal:'control',
        parameter:{unit:'s',minimum:MINIMUM_AUTOMATION_DURATION,maximum:MAXIMUM_AUTOMATION_DURATION}},
      ...(module.settings.shape === 'steps' ? [{
        id:'steps',label:'Step count',direction:'input',signal:'control',
        parameter:{unit:'steps',minimum:1,maximum:MAXIMUM_AUTOMATION_STEPS,
          defaultMaximum:module.settings.points.length-1}
      } as const] : [])
    ],
    validate:module => {if (module.kind === 'automation') validateAutomation(module.settings);}
  },
  lfo: {
    label:'LFO',category:'control',
    create:id => ({id,kind:'lfo',settings:DEFAULT_PATCH_LFO}),
    ports:() => [{id:'control',label:'Value',direction:'output',signal:'control'}],
    validate:module => {if (module.kind === 'lfo') validatePatchLfo(module.settings);}
  },
  simplexNoise: {
    label:'Simplex Noise',category:'control',
    create:id => ({id,kind:'simplexNoise',settings:DEFAULT_SIMPLEX_NOISE}),
    ports:() => [{id:'control',label:'Value',direction:'output',signal:'control'}],
    validate:module => {if (module.kind === 'simplexNoise') validateSimplexNoise(module.settings);}
  },
  filter: {
    label:'Low-pass filter',category:'processor',
    create:id => ({id,kind:'filter',settings:{cutoff:900,resonance:0.7}}),
    ports:() => [audioInput,audioOutput,
      {id:'cutoff',label:'Cutoff',direction:'input',signal:'control',
        parameter:{unit:'Hz',minimum:40,maximum:6000}},
      {id:'resonance',label:'Resonance',direction:'input',signal:'control',
        parameter:{unit:'Q',minimum:0.1,maximum:12}}],
    validate:module => {
      if (module.kind !== 'filter') return;
      requireRange(module.settings.cutoff, 40, 6000, 'Cutoff');
      requireRange(module.settings.resonance, 0.1, 12, 'Resonance');
    }
  },
  gain: {
    label:'Gain',category:'processor',
    create:id => ({id,kind:'gain',settings:{level:0.55}}),
    ports:() => [audioInput,audioOutput,level],
    validate:module => {if (module.kind === 'gain') requireRange(module.settings.level, 0, 1, 'Level');}
  },
  pitchShift: {
    label:'Pitch Shift',category:'processor',
    create:id => ({id,kind:'pitchShift',settings:{semitones:0,cents:0}}),
    ports:() => [audioInput,audioOutput,
      {id:'semitones',label:'Pitch',direction:'input',signal:'control',
        parameter:{unit:'st',minimum:-24,maximum:24}}],
    validate:module => {
      if (module.kind === 'pitchShift' && (!within(module.settings.semitones, -24, 24) ||
          !within(module.settings.cents, -100, 100))) {
        throw new Error('Pitch Shift settings are outside the supported range.');
      }
    }
  },
  shelfEq: {
    label:'Shelf EQ',category:'processor',
    create:id => ({id,kind:'shelfEq',settings:createDefaultShelfEq()}),
    ports:() => [audioInput,audioOutput,
      {id:'lowFrequency',label:'Low frequency',direction:'input',signal:'control',parameter:shelfFrequency},
      {id:'lowGain',label:'Low gain',direction:'input',signal:'control',parameter:shelfGain},
      {id:'highFrequency',label:'High frequency',direction:'input',signal:'control',parameter:shelfFrequency},
      {id:'highGain',label:'High gain',direction:'input',signal:'control',parameter:shelfGain}],
    validate:module => {if (module.kind === 'shelfEq') validateShelfEq(module.settings);}
  },
  reverb: {
    label:'Reverb',category:'processor',
    create:id => ({id,kind:'reverb',settings:{...DEFAULT_REVERB}}),
    ports:() => [audioInput,audioOutput,{...level,id:'mix',label:'Wet Mix'}],
    validate:module => {if (module.kind === 'reverb') validateReverb(module.settings);}
  },
  mixer: {
    label:'Mixer',category:'processor',
    create:id => ({id,kind:'mixer',settings:{levelA:0.5,levelB:0.5}}),
    ports:() => [
      {...audioInput,id:'inputA',label:'Audio A'},
      {...audioInput,id:'inputB',label:'Audio B'},
      {...level,id:'levelA',label:'Level A'},
      {...level,id:'levelB',label:'Level B'},audioOutput],
    validate:module => {
      if (module.kind !== 'mixer') return;
      requireRange(module.settings.levelA, 0, 1, 'Level A');
      requireRange(module.settings.levelB, 0, 1, 'Level B');
    }
  },
  crossfader: {
    label:'Crossfader',category:'processor',
    create:id => ({id,kind:'crossfader',settings:{blend:0.5}}),
    ports:() => [
      {...audioInput,id:'inputA',label:'Audio A'},
      {...audioInput,id:'inputB',label:'Audio B'},
      {...level,id:'blend',label:'Blend'},audioOutput],
    validate:module => {if (module.kind === 'crossfader') requireRange(module.settings.blend, 0, 1, 'Blend');}
  },
  oscilloscope: {
    label:'Oscilloscope',category:'processor',
    create:id => ({id,kind:'oscilloscope',settings:{}}),
    ports:() => [audioInput,audioOutput],validate:noValidation
  },
  output: {
    label:'Output',category:'processor',
    create:id => ({id,kind:'output',settings:{level:0.7}}),
    ports:() => [audioInput,level],
    validate:module => {if (module.kind === 'output') requireRange(module.settings.level, 0, 1, 'Level');}
  }
} satisfies Readonly<Record<PatchModuleKind,PatchModuleDefinition>>;

export const MODULE_LABELS: Readonly<Record<PatchModuleKind,string>> = Object.fromEntries(
  Object.entries(PATCH_MODULE_DEFINITIONS).map(([kind,definition]) => [kind,definition.label])) as
  Readonly<Record<PatchModuleKind,string>>;

const PATCH_MODULE_MENU_ORDER = [
  'wave','drone','chord',
  'lfo','simplexNoise','automation','chordProgression',
  'filter','gain','shelfEq','reverb','mixer','crossfader','oscilloscope','pitchShift','output'
] as const satisfies readonly PatchModuleKind[];

export function getPatchModuleKinds(category: PatchModuleCategory): readonly PatchModuleKind[] {
  return PATCH_MODULE_MENU_ORDER.filter(kind => PATCH_MODULE_DEFINITIONS[kind].category === category);
}

export function createPatchModule(kind: PatchModuleKind, id: string): PatchModule {
  return PATCH_MODULE_DEFINITIONS[kind].create(id);
}

export function getPatchPorts(module: PatchModule): readonly PatchPort[] {
  return PATCH_MODULE_DEFINITIONS[module.kind].ports(module);
}

export function getPatchModuleLabel(module: PatchModule): string {
  return module.kind === 'drone' && module.settings.copiedFrom
    ? `Drone ${module.settings.copiedFrom}`
    : PATCH_MODULE_DEFINITIONS[module.kind].label;
}
