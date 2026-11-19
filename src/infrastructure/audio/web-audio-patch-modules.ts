import { getChordFrequencies } from '../../domain/chord';
import { getShelfFrequencyHz } from '../../domain/drone-shelf-response';
import { WebAudioPitchShift } from './web-audio-pitch-shift';
import { WebAudioShelfEq } from './web-audio-shelf-eq';
import { createDefaultDroneSettings } from '../../domain/drone';
import type { PatchModule } from '../../domain/patch';
import { readAutomationValue } from '../../domain/patch-automation';
import { createControlMonitor } from './web-audio-control-monitor';
import type { WebAudioLfoWorkletFactory } from './web-audio-lfo-worklet';
import { createPatchLfoSignal } from './web-audio-patch-lfo';
import type { PatchAutomation } from '../../domain/patch-automation';
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
  readLfoPhase?(elapsed: number): number;
  readControlValue?(): number;
  dispose(): void;
}

function createAutomationSignal(context: AudioContext, settings: PatchAutomation, origin: number): AudioBufferSourceNode {
  // Generate normalized control samples once. Web Audio advances the source on its own clock.
  const sampleRate = 8000;
  const activeFrames = Math.round(settings.duration * sampleRate);
  const holdFrames = settings.mode === 'once' ? 128 : 0;
  const buffer = context.createBuffer(1, activeFrames + holdFrames, sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < activeFrames; index++) samples[index] = readAutomationValue(settings, index / activeFrames);
  if (holdFrames) samples.fill(readAutomationValue(settings, 1), activeFrames);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  if (holdFrames) source.loopStart = activeFrames / sampleRate;
  const now = context.currentTime;
  const elapsed = Math.max(0, now - origin);
  // Keep the audio loop period equal to the editor duration after rounding to buffer frames.
  const bufferDuration = activeFrames / sampleRate;
  const rate = bufferDuration / settings.duration;
  source.playbackRate.value = rate;
  const position = holdFrames ? Math.min(settings.duration, elapsed) : elapsed % settings.duration;
  source.start(now, position * rate);
  return source;
}

const defaultWave = createDefaultDroneSettings().oscillators[0];

export function createPatchRuntimeModule(
  context: AudioContext, definition: PatchModule, pulse: WebAudioPulseWorkletFactory,
  modulationFactory: WebAudioLowFrequencyOscillatorFactory, lfo: WebAudioLfoWorkletFactory, master: AudioNode, origin: number
): PatchRuntimeModule {
  switch (definition.kind) {
    case 'chord': {
      const output = context.createGain();
      output.gain.value = 0.16;
      const frequencies = getChordFrequencies(definition.settings);
      const oscillators = frequencies.map((frequency,index) => {
        const oscillator = context.createOscillator();
        oscillator.type = index === 0 ? 'sine' : 'triangle';
        oscillator.frequency.value = frequency;
        const gain = context.createGain();
        gain.gain.value = 0;
        const pan = context.createStereoPanner();
        pan.pan.value = frequencies.length === 1 ? 0 : (index/(frequencies.length-1)-0.5)*0.65;
        oscillator.connect(gain).connect(pan).connect(output);
        const start = context.currentTime;
        gain.gain.setValueAtTime(0,start);
        gain.gain.linearRampToValueAtTime(0.75/frequencies.length,start+0.035);
        oscillator.start(start);
        return {oscillator,gain,pan};
      });
      return {definition,output,dispose() {
        for (const {oscillator,gain,pan} of oscillators) {
          oscillator.stop(); oscillator.disconnect(); gain.disconnect(); pan.disconnect();
        }
        output.disconnect();
      }};
    }
    case 'wave': {
      const settings = definition.settings;
      const voice = new WebAudioWaveformSource(context, {...defaultWave, waveform:settings.waveform,
        frequencyHz:settings.frequency, shape:settings.shape, detuneCents:0}, pulse);
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
    case 'lfo': {
      const signal = createPatchLfoSignal(context,lfo,definition.settings,origin);
      return {definition, output:signal.output, readLfoPhase:signal.readPhase, readControlValue:signal.readValue, dispose:signal.dispose};
    }
    case 'automation': {
      const source = createAutomationSignal(context, definition.settings, origin);
      const smoothing = context.createBiquadFilter();
      smoothing.type = 'lowpass';
      smoothing.frequency.value = 80;
      smoothing.Q.value = -3;
      const bounds = context.createWaveShaper();
      bounds.curve = new Float32Array([0, 0, 1]);
      source.connect(smoothing).connect(bounds);
      const monitor = createControlMonitor(context,bounds);
      return {definition, output:bounds, readControlValue:monitor.read, dispose() {
        source.stop(); source.disconnect(); smoothing.disconnect(); bounds.disconnect();
      }};
    }
    case 'pitchShift': {
      const effect = new WebAudioPitchShift(context,definition.settings.semitones,definition.settings.cents);
      return {definition, inputs:{in:effect.input}, output:effect.output, dispose:() => effect.dispose()};
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
