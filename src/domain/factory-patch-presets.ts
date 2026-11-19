import { ARRANGEMENT_DEMO } from './arrangement-demo';
import { createDefaultDroneSettings } from './drone';
import type { OscillatorWaveform } from './drone';
import { applyHarmonicsPreset } from './patch-harmonics';
import type { PatchLfo } from './patch-lfo';
import type { PatchModule } from './patch';
import { audio, control, filter, mixer, output, preset, shelf } from './factory-patch-builder';
import type { FactoryPatchGroup } from './factory-patch-builder';
import { HEAVY_WET_DRONE_PATCHES } from './factory-heavy-wet-drone-patches';

function wave(id: string, waveform: OscillatorWaveform, frequency: number, shape = 0.5): PatchModule {
  return {id,kind:'wave',settings:{waveform,frequency,shape}};
}

function lfo(id: string, waveform: PatchLfo['waveform'], rateHz: number, phaseDegrees = 0): PatchModule {
  return {id,kind:'lfo',settings:{waveform,rateHz,phaseDegrees,sync:true}};
}

function harmonicSteps(id: string, pattern: string, duration: number): PatchModule {
  const settings = applyHarmonicsPreset({shape:'steps',mode:'loop',duration,glide:0,
    points:[{position:0,value:0},{position:1,value:0}]},pattern);
  return {id,kind:'automation',settings};
}

const firstToMixer = audio('first','mixer','inputA');
const secondToMixer = audio('second','mixer','inputB');

function createHallVoice(): PatchModule {
  const voice = createDefaultDroneSettings();
  const pitches = [55,82.41,110,164.81,220];
  const levels = [0.65,0.48,0.31,0.22,0.15];
  const positions = [-0.25,0.38,-0.61,0.56,0];
  return {id:'hall',kind:'drone',settings:{voice:{...voice,gain:0.3,
    oscillators:voice.oscillators.map((oscillator,index) => ({
      ...oscillator, waveform:index < 3 ? 'triangle' : 'sine',
      frequencyHz:pitches[index], volume:levels[index], pan:positions[index]
    })),
    mix:{...voice.mix,reverb:{enabled:true,mix:0.66},
      highShelf:{frequencyHz:1900,gainDecibels:-3}}
  }}};
}

export const FACTORY_PATCH_GROUPS: readonly FactoryPatchGroup[] = [
  {
    label:'Foundations',
    presets:[
      preset('warm-fifths','Warm Fifths',[
        [wave('first','triangle',110),30,36],[wave('second','sine',164.81),30,184],
        [mixer(0.8,0.56),248,84],[shelf(160,2.5,1900,-4),465,84],[output,690,84]
      ],[firstToMixer,secondToMixer,audio('mixer','eq'),audio('eq','output')]),
      preset('glass-octaves','Glass Octaves',[
        [wave('first','sine',110),30,36],[wave('second','foldedSine',220,0.31),30,184],
        [mixer(0.78,0.36),248,84],[shelf(130,-2,3100,2.5),465,84],[output,690,84]
      ],[firstToMixer,secondToMixer,audio('mixer','eq'),audio('eq','output')]),
      preset('velvet-hall','Velvet Hall',[
        [createHallVoice(),55,80],[output,335,80]
      ],[audio('hall','output')])
    ]
  },
  {
    label:'Modulated Drones',
    presets:[
      preset('slow-bloom','Slow Bloom',[
        [wave('first','sawtooth',55),30,36],[wave('second','triangle',110),30,176],
        [mixer(0.64,0.56),245,80],[filter(620,1.9),465,80],[output,690,80],
        [lfo('sweep','sine',0.12),245,242]
      ],[firstToMixer,secondToMixer,audio('mixer','filter'),audio('filter','output'),
        control('sweep','filter','cutoff',145,1850)]),
      preset('crossfade-currents','Crossfade Currents',[
        [wave('first','triangle',82.41),30,36],[wave('second','sineTriangle',123.47,0.7),30,176],
        [mixer(0.5,0.5),350,80],[output,620,80],[lfo('blend','triangle',0.19),125,258]
      ],[firstToMixer,secondToMixer,audio('mixer','output'),
        control('blend','mixer','levelA',0.15,0.9),control('blend','mixer','levelB',0.9,0.15)]),
      preset('random-air','Random Air',[
        [wave('first','foldedSine',146.83,0.29),30,36],[wave('second','sine',73.42),30,176],
        [mixer(0.4,0.7),245,80],[filter(1700,1.4),465,80],[output,690,80],
        [lfo('drift','smoothRandom',0.18),245,252]
      ],[firstToMixer,secondToMixer,audio('mixer','filter'),audio('filter','output'),
        control('drift','first','shape',0.18,0.62),control('drift','filter','cutoff',350,2400)]),
      preset('copper-pulse','Copper Pulse',[
        [wave('tone','square',110),30,55],[filter(460,2.7),245,55],
        [{id:'gain',kind:'gain',settings:{level:0.45}},465,55],[output,690,55],
        [lfo('pulse','square',1.15),88,224],[lfo('brightness','sine',0.11,90),313,224]
      ],[audio('tone','filter'),audio('filter','gain'),audio('gain','output'),
        control('pulse','gain','level',0.16,0.66),control('brightness','filter','cutoff',180,1250)])
    ]
  },
  {
    label:'Sequences',
    presets:[
      preset('minor-orbit','Minor Orbit',[
        [wave('first','sine',55),245,42],[wave('second','triangle',164.81),245,185],
        [mixer(0.68,0.68),460,90],[output,690,90],[harmonicSteps('notes','minor',3),30,185]
      ],[firstToMixer,secondToMixer,audio('mixer','output'),control('notes','second','frequency',110,220)]),
      preset('dorian-steps','Dorian Steps',[
        [wave('first','triangle',73.42),245,42],[wave('second','sineTriangle',146.83,0.83),245,185],
        [mixer(0.66,0.63),460,90],[filter(1550,1.1),680,90],[output,900,90],
        [harmonicSteps('notes','dorian',4),30,185]
      ],[firstToMixer,secondToMixer,audio('mixer','filter'),audio('filter','output'),
        control('notes','second','frequency',146.83,293.66)]),
      preset('clockwork-fifths','Clockwork Fifths',[
        [wave('first','sine',65.41),245,42],[wave('second','foldedSine',130.81,0.37),245,185],
        [mixer(0.7,0.57),460,90],[shelf(125,1.5,2300,-4),680,90],[output,900,90],
        [harmonicSteps('notes','fifths-and-octaves',2),30,185],[lfo('accent','square',2,90),248,333]
      ],[firstToMixer,secondToMixer,audio('mixer','eq'),audio('eq','output'),
        control('notes','second','frequency',130.81,261.62),control('accent','mixer','levelB',0.22,0.64)])
    ]
  },
  {label:'Heavy & Wet Drones',presets:HEAVY_WET_DRONE_PATCHES},
  {label:'Arrangements',presets:[ARRANGEMENT_DEMO]}
];
