import type { ArrangementClip, PatchArrangement } from '@domain/patch/arrangement';
import type { PatchAutomation } from '@domain/patch/automation';
import type { PatchCable, PatchModule } from '@domain/patch';
import type { PatchSnapshot } from '@domain/patch/presets/model';

const low = 155.5635;
const high = 391.9954;
const normalizePitch = (frequency: number) => (frequency-low)/(high-low);
const phrase = (octave: number): PatchAutomation => ({
  duration:5,mode:'loop',shape:'steps',glide:0,
  points:[
    {position:0,value:normalizePitch(195.9977*octave)},
    {position:0.22,value:normalizePitch(low*octave)},
    {position:1,value:normalizePitch(low*octave)}
  ]
});
const brightness: PatchAutomation = {duration:60,mode:'once',shape:'smoothCurve',glide:0,
  points:[{position:0,value:0},{position:0.28,value:0.35},{position:0.60,value:0.85},
    {position:0.88,value:1},{position:1,value:0.28}]};

const nodes: readonly (readonly [PatchModule,number,number])[] = [
  [{id:'foundation',kind:'wave',settings:{waveform:'triangle',frequency:65.4064,shape:0.5}},245,40],
  [{id:'melody',kind:'wave',settings:{waveform:'sine',frequency:195.9977,shape:0.5}},245,220],
  [{id:'contrast',kind:'chord',settings:{rootNote:60,chord:'minor',inversion:1,octave:0,spread:0}},245,389],
  [{id:'phrase',kind:'automation',settings:phrase(1)},20,180],
  [{id:'rests',kind:'automation',settings:{duration:5,mode:'loop',shape:'square',glide:0,
    points:[{position:0,value:0},{position:1,value:1}]}},245,571],
  [{id:'pulse',kind:'automation',settings:{duration:1.4,mode:'loop',shape:'sine',glide:0,
    points:[{position:0,value:0},{position:1,value:1}]}},465,571],
  [{id:'brightness',kind:'automation',settings:brightness},685,340],
  [{id:'phrase-gain',kind:'gain',settings:{level:0}},465,220],
  [{id:'voices',kind:'mixer',settings:{levelA:0.68,levelB:0.55}},685,180],
  [{id:'mix',kind:'mixer',settings:{levelA:0.85,levelB:0.75}},905,40],
  [{id:'filter',kind:'filter',settings:{cutoff:420,resonance:0.9}},1125,40],
  [{id:'output',kind:'output',settings:{level:0.82}},1345,40]
];

function audio(source: string, destination: string, portId = 'in'): PatchCable {
  return {id:`${source}-${destination}`,source:{moduleId:source,portId:'out'},destination:{moduleId:destination,portId}};
}

function control(source: string, destination: string, portId: string, from: number, to: number): PatchCable {
  return {id:`${source}-${destination}`,source:{moduleId:source,portId:'control'},destination:{moduleId:destination,portId},mapping:{from,to}};
}

function clip(id: string, moduleId: string, start: number, duration: number,
  fadeIn: number, fadeOut: number, level = 1): ArrangementClip {
  return {id,moduleId,start,duration,fadeIn,fadeOut,level};
}

const arrangement: PatchArrangement = {
  trackNames:{foundation:'Bass drone',melody:'Melody',contrast:'Chord texture',phrase:'Phrase pitches',
    rests:'Melody rests',pulse:'Pulse',brightness:'Brightness'},
  sections:[
    {id:'opening',name:'Opening',start:0,duration:15},
    {id:'a',name:'A · Gesture',start:15,duration:20},
    {id:'b',name:'B · Pulse',start:35,duration:25},
    {id:'return',name:'A′ · Return',start:60,duration:20},
    {id:'ending',name:'Ending',start:80,duration:8}
  ],
  clips:[
    clip('foundation-long','foundation',0,88,10,8),
    clip('brightness-long','brightness',0,88,3,8),
    clip('melody-a','melody',15,20,0.1,0.3),
    clip('phrase-a','phrase',15,20,0,0),
    clip('rests-a','rests',15,20,0,0),
    clip('contrast-b','contrast',35,25,8,3),
    clip('pulse-b','pulse',35,25,9,2),
    clip('melody-return','melody',60,20,0.1,1,0.67),
    {...clip('phrase-return','phrase',60,20,0,0),automation:phrase(2)},
    clip('rests-return','rests',60,20,0,0)
  ],
  tail:2
};

export const ARRANGEMENT_DEMO = {
  id:'drone-in-five-sections',name:'Drone in Five Sections',
  patch:{version:1,modules:nodes.map(([module]) => module),cables:[
    audio('foundation','mix','inputA'),audio('melody','phrase-gain'),audio('phrase-gain','voices','inputA'),
    audio('contrast','voices','inputB'),audio('voices','mix','inputB'),audio('mix','filter'),audio('filter','output'),
    control('phrase','melody','frequency',low,high),control('rests','phrase-gain','level',0.72,0),
    control('pulse','voices','levelB',0.13,0.68),control('brightness','filter','cutoff',220,1900)
  ]},
  layout:Object.fromEntries(nodes.map(([module,x,y]) => [module.id,{x,y}])),
  viewport:{x:0,y:0},arrangement
} satisfies PatchSnapshot & {id: string; name: string};
