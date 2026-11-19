import { loadBuiltInOscillatorBank } from './built-in-oscillator-banks';
import { createDefaultDroneLayer } from './drone-layers';
import { audio, control, filter, mixer, output, preset, shelf } from './factory-patch-builder';
import type { PatchAutomation } from './patch-automation';
import { setPatchDroneLayer } from './patch';
import type { PatchDrone, PatchModule } from './patch';

function drone(id: string, bank: string, root: number, gain: number, wet: number): PatchDrone {
  const layer = loadBuiltInOscillatorBank(bank,createDefaultDroneLayer('A'));
  const transpose = root/layer.drone.oscillators[0].frequencyHz;
  const voice = {...layer.drone,gain,
    oscillators:layer.drone.oscillators.map(oscillator =>
      ({...oscillator,frequencyHz:oscillator.frequencyHz*transpose})),
    mix:{...layer.drone.mix,reverb:{enabled:true,mix:wet}}};
  return setPatchDroneLayer({id,kind:'drone',settings:{voice}},{...layer,drone:voice});
}

function curve(id: string, duration: number, points: readonly (readonly [number,number])[]): PatchModule {
  return {id,kind:'automation',settings:{shape:'smoothCurve',duration,mode:'loop',glide:0,
    points:points.map(([position,value]) => ({position,value}))}};
}

function steps(id: string, duration: number, values: readonly number[], glide: number): PatchModule {
  const points: PatchAutomation['points'] = values.map((value,index) => ({position:index/values.length,value}));
  return {id,kind:'automation',settings:{shape:'steps',duration,mode:'loop',glide,
    points:[...points,{position:1,value:values[values.length-1]}]}};
}

const shortwave = drone('siren','shortwave-dust',41.2034,0.88,0.62);
const siren: PatchDrone = {...shortwave,settings:{...shortwave.settings,voice:{...shortwave.settings.voice,
  oscillators:shortwave.settings.voice.oscillators.map((oscillator,index) => index === 2
    ? {...oscillator,waveform:'foldedSine',shape:0.64} : oscillator)
}}};

export const HEAVY_WET_DRONE_PATCHES = [
  preset('flooded-foundry','Flooded Foundry',[
    [drone('metal','rust-mouth',36.7081,0.71,0.31),32,34],
    [drone('choir','sunken-choir',73.4162,0.69,0.77),32,150],
    [{id:'blend',kind:'crossfader',settings:{blend:0.3}},250,76],
    [filter(1050,1.4),475,76],[output,700,76],
    [curve('tide',23,[[0,0.08],[0.28,0.36],[0.58,1],[0.83,0.56],[1,0.08]]),32,276],
    [curve('grit',11,[[0,0.72],[0.37,0.2],[0.56,0.92],[0.72,0.39],[1,0.72]]),250,276]
  ],[
    audio('metal','blend','inputA'),audio('choir','blend','inputB'),audio('blend','filter'),audio('filter','output'),
    control('tide','blend','blend',0.1,0.76),control('grit','filter','cutoff',580,2400)
  ]),
  preset('drowned-conveyor','Drowned Conveyor',[
    [drone('machinery','broken-conveyor',41.2034,0.68,0.41),32,34],
    [filter(720,3.1),250,34],
    [drone('rain','rain-vault',82.4069,0.7,0.83),250,174],
    [mixer(0.7,0.66),474,90],[output,700,90],
    [steps('ratchet',8,[0.9,0.24,0.64,0.07,1,0.33,0.72,0.15],0.18),32,220]
  ],[
    audio('machinery','filter'),audio('filter','mixer','inputA'),audio('rain','mixer','inputB'),audio('mixer','output'),
    control('ratchet','filter','cutoff',280,2150),control('ratchet','mixer','levelA',0.39,0.9)
  ]),
  preset('silt-pressure','Silt Pressure',[
    [drone('silt','shortwave-dust',58.2705,0.76,0.49),32,34],
    [filter(530,1.9),250,34],
    [drone('pressure','tidal-glass',116.541,0.72,0.78),250,176],
    [mixer(0.76,0.43),474,90],[shelf(115,2.5,2250,-5),700,90],[output,926,90],
    [{id:'drift',kind:'lfo',settings:{waveform:'smoothRandom',rateHz:0.21,phaseDegrees:0,sync:true}},32,214],
    [curve('swell',17,[[0,0.12],[0.2,0.21],[0.47,0.86],[0.65,1],[0.86,0.32],[1,0.12]]),474,276]
  ],[
    audio('silt','filter'),audio('filter','mixer','inputA'),audio('pressure','mixer','inputB'),
    audio('mixer','eq'),audio('eq','output'),control('drift','filter','cutoff',230,1600),
    control('swell','mixer','levelB',0.23,0.78)
  ]),
  preset('blackwater-siren','Blackwater Siren',[
    [siren,32,44],
    [{id:'lower-voice',kind:'pitchShift',settings:{semitones:-12,cents:-7}},250,176],
    [filter(950,1.5),474,176],
    [mixer(0.79,0.42),700,72],[output,926,72],
    [steps('falling-pitches',10,[0,0.29,1,0.57,0],0.12),32,218],
    [curve('undertow',19,[[0,0.16],[0.23,0.31],[0.55,0.95],[0.74,0.68],[1,0.16]]),474,322]
  ],[
    audio('siren','mixer','inputA'),audio('siren','lower-voice'),audio('lower-voice','filter'),
    audio('filter','mixer','inputB'),audio('mixer','output'),control('falling-pitches','lower-voice','semitones',-12,-5),
    control('undertow','mixer','levelB',0.17,0.67)
  ])
];
