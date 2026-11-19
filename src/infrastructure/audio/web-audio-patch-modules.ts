import { createDefaultDroneSettings } from '../../domain/drone';
import type { PatchModule } from '../../domain/patch';
import { readAutomationValue } from '../../domain/patch-automation';
import type { PatchAutomation } from '../../domain/patch-automation';
import { WebAudioDrone } from './web-audio-drone';
import type { WebAudioPulseWorkletFactory } from './web-audio-pulse-worklet';
import { WebAudioWaveformSource } from './web-audio-waveform-source';

interface ParameterBinding {
  readonly parameter: AudioParam;
  readonly base: number;
}

export interface PatchRuntimeModule {
  readonly definition: PatchModule;
  readonly input?: AudioNode;
  readonly output?: AudioNode;
  readonly parameters?: Readonly<Record<string, ParameterBinding>>;
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
  const duration = activeFrames / sampleRate;
  source.start(now, holdFrames ? Math.min(duration, elapsed) : elapsed % duration);
  return source;
}

const defaultWave = createDefaultDroneSettings().oscillators[0];

export function createPatchRuntimeModule(
  context: AudioContext, definition: PatchModule, pulse: WebAudioPulseWorkletFactory,
  master: AudioNode, origin: number
): PatchRuntimeModule {
  switch (definition.kind) {
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
      const voice = new WebAudioDrone(context, definition.settings.voice, pulse);
      voice.start();
      return {definition, output:voice.output, dispose:() => voice.dispose()};
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
      return {definition, output:bounds, dispose() {
        source.stop(); source.disconnect(); smoothing.disconnect(); bounds.disconnect();
      }};
    }
    case 'filter': {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = definition.settings.cutoff;
      filter.Q.value = definition.settings.resonance;
      return {definition, input:filter, output:filter, parameters:{
        cutoff:{parameter:filter.frequency,base:definition.settings.cutoff},
        resonance:{parameter:filter.Q,base:definition.settings.resonance}
      }, dispose:() => filter.disconnect()};
    }
    case 'gain':
    case 'output': {
      const gain = context.createGain();
      gain.gain.value = definition.settings.level;
      if (definition.kind === 'output') gain.connect(master);
      return {definition, input:gain, output:gain,
        parameters:{level:{parameter:gain.gain,base:definition.settings.level}}, dispose:() => gain.disconnect()};
    }
  }
}
