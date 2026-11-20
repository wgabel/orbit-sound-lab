import { DroneController } from '@application/drone-controller';
import { createDefaultDroneSettings } from '@domain/drone';
import { readPatchDroneLayer } from '@domain/patch';
import type { PatchRuntimeFactory } from './contracts';
import { readAutomationValue } from '@domain/patch/automation';
import type { PatchAutomation } from '@domain/patch/automation';
import { readClipElapsed } from '@domain/patch/arrangement';
import { tuneSceneLayer } from '@domain/sound-scene';
import { createPatchChordVoice } from '@infrastructure/audio/patch/chords';
import { createPatchLfoSignal } from '@infrastructure/audio/patch/lfo';
import { createAutomationTimingSignal } from '@infrastructure/audio/web-audio-automation-timing';
import { createControlMonitor } from '@infrastructure/audio/web-audio-control-monitor';
import { WebAudioDroneFactory } from '@infrastructure/audio/web-audio-drone-factory';
import { WebAudioGraph } from '@infrastructure/audio/web-audio-graph';
import { WebAudioModulationMatrix } from '@infrastructure/audio/web-audio-modulation-matrix';
import { WebAudioWaveformSource } from '@infrastructure/audio/web-audio-waveform-source';

const defaultWave = createDefaultDroneSettings().oscillators[0];

export const createChordRuntime: PatchRuntimeFactory<'chord'> = (definition,{context,origin,options}) => {
  const voice = createPatchChordVoice(context,definition.settings,origin,options.chordRoute);
  return {definition,...voice,chordProgression:options.chordRoute?.settings};
};

export const createChordProgressionRuntime: PatchRuntimeFactory<'chordProgression'> = definition =>
  ({definition,dispose() {}});

export const createWaveRuntime: PatchRuntimeFactory<'wave'> = (definition,{context,pulse}) => {
  const settings = definition.settings;
  const voice = new WebAudioWaveformSource(context,{...defaultWave,waveform:settings.waveform,
    frequencyHz:settings.frequency,shape:settings.shape,cycleEnvelope:settings.cycleEnvelope,
    detuneCents:0},pulse);
  const level = context.createGain();
  level.gain.value = 0.18;
  voice.output.connect(level);
  voice.start(context.currentTime);
  return {definition,output:level,parameters:{
    frequency:{parameter:voice.frequency,base:settings.frequency},
    shape:{parameter:voice.shape,base:voice.shape.value}
  },dispose() {voice.dispose();level.disconnect();}};
};

export const createDroneRuntime: PatchRuntimeFactory<'drone'> = (
  definition,{context,pulse,modulationFactory}
) => {
  const layer = readPatchDroneLayer(definition);
  const output = context.createGain();
  const graph = new WebAudioGraph();
  graph.register({id:'output',inputs:[{id:'audio',node:output}],outputs:[]});
  const controller = new DroneController(context,new WebAudioDroneFactory(context,pulse),graph,
    new WebAudioModulationMatrix(),modulationFactory,tuneSceneLayer(layer),layer.modulation,
    'drone',{moduleId:'output',portId:'audio'});
  const dispose = () => {controller.dispose();graph.dispose();output.disconnect();};
  try {
    controller.startPreparedVoice();
  } catch (error) {
    dispose();
    throw error;
  }
  return {definition,output,dispose};
};

export const createSimplexNoiseRuntime: PatchRuntimeFactory<'simplexNoise'> = (
  definition,{simplexNoise,origin}
) => ({definition,...simplexNoise.create(definition.settings,origin)});

export const createLfoRuntime: PatchRuntimeFactory<'lfo'> = (definition,{context,lfo,origin}) => {
  const signal = createPatchLfoSignal(context,lfo,definition.settings,origin);
  return {definition,output:signal.output,readLfoPhase:signal.readPhase,
    readControlValue:signal.readValue,dispose:signal.dispose};
};

function createAutomationBuffer(context: AudioContext, settings: PatchAutomation): AudioBuffer {
  const sampleRate = 8000;
  const activeFrames = Math.round(settings.duration * sampleRate);
  const holdFrames = settings.mode === 'once' ? 128 : 0;
  const buffer = context.createBuffer(1,activeFrames+holdFrames,sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index=0;index<activeFrames;index++) {
    samples[index] = readAutomationValue(settings,index/activeFrames);
  }
  if (holdFrames) samples.fill(readAutomationValue(settings,1),activeFrames);
  return buffer;
}

function startAutomationSignal(context: AudioContext, settings: PatchAutomation, buffer: AudioBuffer,
  start: number, elapsed: number, end?: number): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const once = settings.mode === 'once';
  const bufferDuration = (buffer.length-(once ? 128 : 0))/buffer.sampleRate;
  if (once) source.loopStart = bufferDuration;
  const rate = bufferDuration/settings.duration;
  source.playbackRate.value = rate;
  const position = once ? Math.min(settings.duration,elapsed) : elapsed%settings.duration;
  source.start(start,position*rate);
  if (end !== undefined) source.stop(end);
  return source;
}

export const createAutomationRuntime: PatchRuntimeFactory<'automation'> = (
  definition,{context,origin,options}
) => {
  const timing = options.automationTiming && createAutomationTimingSignal(
    context,definition.settings,origin,options.automationTiming,options.clips);
  const smoothing = context.createBiquadFilter();
  smoothing.type = 'lowpass';
  smoothing.frequency.value = 80;
  smoothing.Q.value = -3;
  const bounds = context.createWaveShaper();
  bounds.curve = new Float32Array([0,0,1]);
  smoothing.connect(bounds);
  const monitor = createControlMonitor(context,bounds);
  if (timing) {
    timing.output.connect(smoothing);
    return {definition,output:bounds,parameters:timing.parameters,readControlValue:monitor.read,
      readAutomationTiming:timing.readTiming,dispose() {
        timing.dispose();smoothing.disconnect();bounds.disconnect();
      }};
  }
  const sources: AudioBufferSourceNode[] = [];
  const buffers = new Map<string,AudioBuffer>();
  function startSignal(settings: PatchAutomation, start: number, elapsed: number, end?: number) {
    const key = JSON.stringify(settings);
    let buffer = buffers.get(key);
    if (!buffer) {
      buffer = createAutomationBuffer(context,settings);
      buffers.set(key,buffer);
    }
    const source = startAutomationSignal(context,settings,buffer,start,elapsed,end);
    sources.push(source);
    source.connect(smoothing);
  }
  if (options.clips) {
    for (const clip of options.clips) {
      const end = origin+clip.start+clip.duration;
      const start = Math.max(context.currentTime,origin+clip.start);
      if (start < end) {
        startSignal(clip.automation ?? definition.settings,start,
          Math.max(0,readClipElapsed(clip,start-origin)),end);
      }
    }
  } else {
    const start = context.currentTime;
    startSignal(definition.settings,start,Math.max(0,start-origin));
  }
  return {definition,output:bounds,readControlValue:monitor.read,dispose() {
    for (const source of sources) {source.stop();source.disconnect();}
    smoothing.disconnect();
    bounds.disconnect();
  }};
};
