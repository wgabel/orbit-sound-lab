import type { WebAudioSimplexNoiseFactory } from './web-audio-simplex-noise';
import { createAutomationTimingSignal } from './web-audio-automation-timing';
import type { AutomationTimingRoute } from './web-audio-automation-timing';
import type { WebAudioPitchShiftWorkletFactory } from './web-audio-pitch-shift-worklet';
import { readClipElapsed } from '../../domain/patch-arrangement';
import type { ArrangementClip } from '../../domain/patch-arrangement';
import { createPatchChordVoice } from './web-audio-patch-chords';
import type { ChordRoute } from './web-audio-patch-chords';
import { getShelfFrequencyHz } from '../../domain/drone-shelf-response';
import { WebAudioPitchShift } from './web-audio-pitch-shift';
import { WebAudioReverb } from './web-audio-reverb';
import { WebAudioShelfEq } from './web-audio-shelf-eq';
import { createDefaultDroneSettings } from '../../domain/drone';
import type { PatchModule } from '../../domain/patch';
import { readAutomationValue } from '../../domain/patch-automation';
import { createControlMonitor } from './web-audio-control-monitor';
import type { WebAudioLfoWorkletFactory } from './web-audio-lfo-worklet';
import { createPatchLfoSignal } from './web-audio-patch-lfo';
import type { AutomationPlaybackTiming, PatchAutomation } from '../../domain/patch-automation';
import { DroneController } from '../../application/drone-controller';
import { readPatchDroneLayer } from '../../domain/patch';
import { tuneSceneLayer } from '../../domain/sound-scene';
import { WebAudioDroneFactory } from './web-audio-drone-factory';
import { WebAudioGraph } from './web-audio-graph';
import type { WebAudioLowFrequencyOscillatorFactory } from './web-audio-low-frequency-oscillator';
import { WebAudioModulationMatrix } from './web-audio-modulation-matrix';
import type { WebAudioPulseWorkletFactory } from './web-audio-pulse-worklet';
import { WebAudioWaveformSource } from './web-audio-waveform-source';

interface ParameterBinding {
  readonly parameter: AudioParam;
  readonly base: number;
  readonly constrain?: (value: number) => number;
}

export interface PatchRuntimeModule {
  readonly definition: PatchModule;
  readonly inputs?: Readonly<Partial<Record<string, AudioNode>>>;
  readonly output?: AudioNode;
  readonly parameters?: Readonly<Record<string, ParameterBinding>>;
  readonly waveformAnalyser?: AnalyserNode;
  readonly chordProgression?: ChordRoute['settings'];
  readLfoPhase?(elapsed: number): number;
  readControlValue?(): number;
  readAutomationTiming?(elapsed: number): AutomationPlaybackTiming | undefined;
  dispose(): void;
}

function createAutomationBuffer(context: AudioContext, settings: PatchAutomation): AudioBuffer {
  // Generate normalized control samples once. Web Audio advances the source on its own clock.
  const sampleRate = 8000;
  const activeFrames = Math.round(settings.duration * sampleRate);
  const holdFrames = settings.mode === 'once' ? 128 : 0;
  const buffer = context.createBuffer(1, activeFrames + holdFrames, sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < activeFrames; index++) samples[index] = readAutomationValue(settings, index / activeFrames);
  if (holdFrames) samples.fill(readAutomationValue(settings, 1), activeFrames);
  return buffer;
}

function startAutomationSignal(context: AudioContext, settings: PatchAutomation, buffer: AudioBuffer,
  start: number, elapsed: number, end?: number): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const once = settings.mode === 'once';
  const bufferDuration = (buffer.length - (once ? 128 : 0)) / buffer.sampleRate;
  if (once) source.loopStart = bufferDuration;
  // Keep the audio loop period equal to the editor duration after rounding to buffer frames.
  const rate = bufferDuration / settings.duration;
  source.playbackRate.value = rate;
  const position = once ? Math.min(settings.duration, elapsed) : elapsed % settings.duration;
  source.start(start, position * rate);
  if (end !== undefined) source.stop(end);
  return source;
}

const defaultWave = createDefaultDroneSettings().oscillators[0];

export function createPatchRuntimeModule(
  context: AudioContext, definition: PatchModule, pulse: WebAudioPulseWorkletFactory,
  modulationFactory: WebAudioLowFrequencyOscillatorFactory, lfo: WebAudioLfoWorkletFactory,
  simplexNoise: WebAudioSimplexNoiseFactory, master: AudioNode, origin: number,
  {clips,chordRoute,pitchWorklet,automationTiming}: {clips?: readonly ArrangementClip[]; chordRoute?: ChordRoute;
    automationTiming?: AutomationTimingRoute;
    pitchWorklet?: WebAudioPitchShiftWorkletFactory} = {}
): PatchRuntimeModule {
  switch (definition.kind) {
    case 'chord': {
      const voice = createPatchChordVoice(context,definition.settings,origin,chordRoute);
      return {definition,...voice,chordProgression:chordRoute?.settings};
    }
    case 'chordProgression': return {definition,dispose() {}};
    case 'wave': {
      const settings = definition.settings;
      const voice = new WebAudioWaveformSource(context, {...defaultWave, waveform:settings.waveform,
        frequencyHz:settings.frequency, shape:settings.shape, cycleEnvelope:settings.cycleEnvelope, detuneCents:0}, pulse);
      const level = context.createGain();
      level.gain.value = 0.18;
      voice.output.connect(level);
      voice.start(context.currentTime);
      return {definition, output:level, parameters:{
        frequency:{parameter:voice.frequency,base:settings.frequency},
        shape:{parameter:voice.shape,base:voice.shape.value}
      }, dispose() {voice.dispose(); level.disconnect();}};
    }
    case 'drone': {
      const layer = readPatchDroneLayer(definition);
      const output = context.createGain();
      const graph = new WebAudioGraph();
      graph.register({id:'output',inputs:[{id:'audio',node:output}],outputs:[]});
      const controller = new DroneController(context, new WebAudioDroneFactory(context,pulse), graph,
        new WebAudioModulationMatrix(), modulationFactory, tuneSceneLayer(layer), layer.modulation,
        'drone', {moduleId:'output',portId:'audio'});
      const dispose = () => {controller.dispose(); graph.dispose(); output.disconnect();};
      try {
        controller.startPreparedVoice();
      } catch (error) {
        dispose();
        throw error;
      }
      return {definition, output, dispose};
    }
    case 'simplexNoise': return {definition,...simplexNoise.create(definition.settings,origin)};
    case 'lfo': {
      const signal = createPatchLfoSignal(context,lfo,definition.settings,origin);
      return {definition, output:signal.output, readLfoPhase:signal.readPhase, readControlValue:signal.readValue, dispose:signal.dispose};
    }
    case 'automation': {
      const timing = automationTiming && createAutomationTimingSignal(context,definition.settings,origin,automationTiming,clips);
      const smoothing = context.createBiquadFilter();
      smoothing.type = 'lowpass';
      smoothing.frequency.value = 80;
      smoothing.Q.value = -3;
      const bounds = context.createWaveShaper();
      bounds.curve = new Float32Array([0, 0, 1]);
      smoothing.connect(bounds);
      const monitor = createControlMonitor(context,bounds);
      if (timing) {
        timing.output.connect(smoothing);
        return {definition,output:bounds,parameters:timing.parameters,readControlValue:monitor.read,
          readAutomationTiming:timing.readTiming,dispose() {
            timing.dispose(); smoothing.disconnect(); bounds.disconnect();
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
      if (clips) {
        for (const clip of clips) {
          const end = origin + clip.start + clip.duration;
          const start = Math.max(context.currentTime,origin+clip.start);
          if (start < end) startSignal(clip.automation ?? definition.settings,start,Math.max(0,readClipElapsed(clip,start-origin)),end);
        }
      } else {
        const start = context.currentTime;
        startSignal(definition.settings,start,Math.max(0,start-origin));
      }
      return {definition, output:bounds, readControlValue:monitor.read, dispose() {
        for (const source of sources) {source.stop(); source.disconnect();}
        smoothing.disconnect();
        bounds.disconnect();
      }};
    }
    case 'pitchShift': {
      const {semitones,cents} = definition.settings;
      if (pitchWorklet) {
        const effect = pitchWorklet.create(semitones,cents);
        return {definition,inputs:{in:effect.input},output:effect.output,
          parameters:{semitones:{parameter:effect.pitch,base:semitones}},dispose:effect.dispose};
      }
      const effect = new WebAudioPitchShift(context,semitones,cents);
      return {definition,inputs:{in:effect.input},output:effect.output,dispose:() => effect.dispose()};
    }
    case 'filter': {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = definition.settings.cutoff;
      filter.Q.value = definition.settings.resonance;
      return {definition, inputs:{in:filter}, output:filter, parameters:{
        cutoff:{parameter:filter.frequency,base:definition.settings.cutoff},
        resonance:{parameter:filter.Q,base:definition.settings.resonance}
      }, dispose:() => filter.disconnect()};
    }
    case 'crossfader': {
      const channelA = context.createGain();
      const channelB = context.createGain();
      const output = context.createGain();
      const blend = context.createConstantSource();
      blend.offset.value = definition.settings.blend;
      // Complementary bounded gains keep identical input signals at unity through the full fade.
      const weightA = context.createWaveShaper();
      weightA.curve = new Float32Array([1,1,0]);
      const weightB = context.createWaveShaper();
      weightB.curve = new Float32Array([0,0,1]);
      channelA.gain.value = 0;
      channelB.gain.value = 0;
      blend.connect(weightA).connect(channelA.gain);
      blend.connect(weightB).connect(channelB.gain);
      channelA.connect(output);
      channelB.connect(output);
      blend.start();
      return {definition,inputs:{inputA:channelA,inputB:channelB},output,
        parameters:{blend:{parameter:blend.offset,base:definition.settings.blend}},
        dispose() {
          blend.stop();
          blend.disconnect();
          weightA.disconnect();
          weightB.disconnect();
          channelA.disconnect();
          channelB.disconnect();
          output.disconnect();
        }};
    }
    case 'mixer': {
      const channelA = context.createGain();
      const channelB = context.createGain();
      const output = context.createGain();
      const {levelA, levelB} = definition.settings;
      channelA.gain.value = levelA;
      channelB.gain.value = levelB;
      channelA.connect(output);
      channelB.connect(output);
      return {definition, inputs:{inputA:channelA, inputB:channelB}, output, parameters:{
        levelA:{parameter:channelA.gain, base:levelA},
        levelB:{parameter:channelB.gain, base:levelB}
      }, dispose() {channelA.disconnect(); channelB.disconnect(); output.disconnect();}};
    }
    case 'reverb': {
      const effect = new WebAudioReverb(context,{...definition.settings,enabled:true});
      const mix = effect.enableMixAutomation(definition.settings.mix);
      return {definition,inputs:{in:effect.input},output:effect.output,
        parameters:{mix:{parameter:mix,base:definition.settings.mix}},dispose:() => effect.dispose()};
    }
    case 'shelfEq': {
      const shelf = new WebAudioShelfEq(context,definition.settings);
      const {lowShelf,highShelf} = shelf;
      const constrain = (value: number) => getShelfFrequencyHz(value,context.sampleRate);
      return {definition, inputs:{in:lowShelf}, output:highShelf, parameters:{
        lowFrequency:{parameter:lowShelf.frequency,base:lowShelf.frequency.value,constrain},
        lowGain:{parameter:lowShelf.gain,base:lowShelf.gain.value},
        highFrequency:{parameter:highShelf.frequency,base:highShelf.frequency.value,constrain},
        highGain:{parameter:highShelf.gain,base:highShelf.gain.value}
      }, dispose:() => shelf.dispose()};
    }
    case 'oscilloscope': {
      const signal = context.createGain();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      // Keep analysis on a side branch so the audio output carries the original channels.
      signal.connect(analyser);
      return {definition, inputs:{in:signal}, output:signal, waveformAnalyser:analyser,
        dispose() {signal.disconnect(); analyser.disconnect();}};
    }
    case 'output':
    case 'gain': {
      const gain = context.createGain();
      gain.gain.value = definition.settings.level;
      if (definition.kind === 'output') gain.connect(master);
      return {definition, inputs:{in:gain}, output:gain,
        parameters:{level:{parameter:gain.gain,base:definition.settings.level}}, dispose:() => gain.disconnect()};
    }
  }
}
