import type { PatchPlayback } from '../../application/patch-playback';
import { hasPatchCycle, validatePatch } from '../../domain/patch';
import type { Patch, PatchCable } from '../../domain/patch';
import { fadeGain, PLAYBACK_FADE_SECONDS } from './web-audio-fade';
import { WebAudioLfoWorkletFactory } from './web-audio-lfo-worklet';
import { WebAudioLowFrequencyOscillatorFactory } from './web-audio-low-frequency-oscillator';
import { readOutputContextTime } from './web-audio-output-clock';
import { WebAudioOutputProtection } from './web-audio-output-protection';
import { createPatchRuntimeModule } from './web-audio-patch-modules';
import type { PatchRuntimeModule } from './web-audio-patch-modules';
import { WebAudioPulseWorkletFactory } from './web-audio-pulse-worklet';

interface RuntimeCable {
  readonly definition: PatchCable;
  readonly source: PatchRuntimeModule;
  readonly destination: PatchRuntimeModule;
  readonly level: GainNode;
  connect(): void;
  dispose(): void;
}

function createRuntimeCable(context: AudioContext, definition: PatchCable,
  source: PatchRuntimeModule, destination: PatchRuntimeModule): RuntimeCable {
  if (!source.output) throw new Error('Missing runtime output.');
  const output = source.output;
  const level = context.createGain();
  level.gain.value = 0;
  const mapping = definition.mapping;
  if (!mapping) {
    const input = destination.inputs?.[definition.destination.portId];
    if (!input) throw new Error('Missing runtime audio input.');
    level.connect(input);
    let connected = false;
    return {definition, source, destination, level,
      connect() {output.connect(level); connected = true;},
      dispose() {if (connected) output.disconnect(level); level.disconnect();}
    };
  }
  const binding = destination.parameters?.[definition.destination.portId];
  if (!binding) throw new Error('Missing runtime parameter input.');
  const from = binding.constrain?.(mapping.from) ?? mapping.from;
  const to = binding.constrain?.(mapping.to) ?? mapping.to;
  const scale = context.createGain();
  scale.gain.value = to - from;
  const offset = context.createConstantSource();
  offset.offset.value = from - binding.base;
  offset.connect(level);
  scale.connect(level);
  level.connect(binding.parameter);
  offset.start();
  let connected = false;
  return {definition, source, destination, level,
    connect() {output.connect(scale); connected = true;},
    dispose() {
    if (connected) output.disconnect(scale);
    scale.disconnect();
    offset.stop();
    offset.disconnect();
    level.disconnect();
  }};
}

export class WebAudioPatchPlayback implements PatchPlayback {
  private readonly lfo: WebAudioLfoWorkletFactory;
  private readonly modulationFactory: WebAudioLowFrequencyOscillatorFactory;
  private readonly pulse: WebAudioPulseWorkletFactory;
  private readonly protection: WebAudioOutputProtection;
  private readonly master: GainNode;
  private readonly analyser: AnalyserNode;
  private readonly samples: Float32Array<ArrayBuffer> = new Float32Array(1024);
  private modules = new Map<string, PatchRuntimeModule>();
  private cables = new Map<string, RuntimeCable>();
  private readonly retiringCables = new Set<RuntimeCable>();
  private readonly retirement = new Set<() => void>();
  private origin = 0;
  private audibleElapsed = 0;
  private state: 'ready' | 'starting' | 'playing' | 'stopping' | 'disposed' = 'ready';

  constructor(private readonly context: AudioContext) {
    this.pulse = new WebAudioPulseWorkletFactory(context);
    this.lfo = new WebAudioLfoWorkletFactory(context);
    this.modulationFactory = new WebAudioLowFrequencyOscillatorFactory(context,this.lfo);
    this.protection = new WebAudioOutputProtection(context);
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = this.samples.length;
    this.master.connect(this.protection.input);
    this.protection.output.connect(this.analyser).connect(context.destination);
  }

  get sampleRate(): number { return this.context.sampleRate; }

  async start(patch: Patch): Promise<void> {
    if (this.state !== 'ready') throw new Error('Patch playback is busy.');
    validatePatch(patch);
    this.state = 'starting';
    try {
      await Promise.all([this.context.resume(), this.pulse.prepare(), this.lfo.prepare()]);
      if (!this.isStarting()) return;
      this.origin = this.context.currentTime;
      this.audibleElapsed = 0;
      this.applyPatch(patch);
      this.state = 'playing';
      fadeGain(this.master.gain, 0.8, this.origin);
    } catch (error) {
      if (this.isStarting()) this.state = 'ready';
      throw error;
    }
  }

  private isStarting(): boolean { return this.state === 'starting'; }

  update(patch: Patch): void {
    validatePatch(patch);
    if (this.state === 'playing') this.applyPatch(patch);
  }

  readAudibleElapsed(): number {
    if (this.state !== 'playing') return 0;
    if (this.context.state === 'running') {
      const outputTime = readOutputContextTime(this.context, performance.now());
      this.audibleElapsed = Math.max(0, outputTime - this.origin - this.protection.lookaheadSeconds);
    }
    return this.audibleElapsed;
  }

  readOutputLevel(): number {
    if (this.state !== 'playing') return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    let energy = 0;
    for (const sample of this.samples) energy += sample * sample;
    return Math.sqrt(energy / this.samples.length);
  }

  private applyPatch(patch: Patch): void {
    const nextModules = new Map<string, PatchRuntimeModule>();
    const nextCables = new Map<string, RuntimeCable>();
    const createdModules: PatchRuntimeModule[] = [];
    const createdCables: RuntimeCable[] = [];
    try {
      for (const definition of patch.modules) {
        const previous = this.modules.get(definition.id);
        const module = previous?.definition === definition ? previous :
          createPatchRuntimeModule(this.context, definition, this.pulse, this.modulationFactory, this.master, this.origin);
        if (module !== previous) createdModules.push(module);
        nextModules.set(definition.id, module);
      }
      for (const definition of patch.cables) {
        const source = nextModules.get(definition.source.moduleId);
        const destination = nextModules.get(definition.destination.moduleId);
        if (!source || !destination) throw new Error('Missing runtime module.');
        const previous = this.cables.get(definition.id);
        const cable = previous?.definition === definition && previous.source === source && previous.destination === destination
          ? previous : createRuntimeCable(this.context, definition, source, destination);
        if (cable !== previous) createdCables.push(cable);
        nextCables.set(definition.id, cable);
      }
    } catch (error) {
      for (const cable of createdCables) cable.dispose();
      for (const module of createdModules) module.dispose();
      throw error;
    }
    const oldModules = [...this.modules.values()].filter(module => nextModules.get(module.definition.id) !== module);
    const oldCables = [...this.cables.values()].filter(cable => nextCables.get(cable.definition.id) !== cable);
    const now = this.context.currentTime;
    const overlaps = [...this.retiringCables, ...oldCables];
    const immediate = hasPatchCycle([...patch.cables, ...overlaps.map(cable => cable.definition)]);
    if (immediate) {
      for (const finish of this.retirement) finish();
      for (const cable of oldCables) cable.dispose();
      for (const module of oldModules) module.dispose();
    } else if (oldCables.length || oldModules.length) {
      for (const cable of oldCables) {
        this.retiringCables.add(cable);
        fadeGain(cable.level.gain, 0, now);
      }
      this.afterFade(now, () => {
        for (const cable of oldCables) {
          this.retiringCables.delete(cable);
          cable.dispose();
        }
        for (const module of oldModules) module.dispose();
      });
    }
    for (const cable of createdCables) {
      cable.connect();
      fadeGain(cable.level.gain, 1, now);
    }
    this.modules = nextModules;
    this.cables = nextCables;
  }

  private afterFade(now: number, callback: () => void): void {
    if (this.context.state !== 'running') {
      callback();
      return;
    }
    const clock = this.context.createConstantSource();
    const finish = () => {
      if (!this.retirement.delete(finish)) return;
      clock.onended = null;
      clock.stop();
      this.context.removeEventListener('statechange', onStateChange);
      callback();
    };
    const onStateChange = () => { if (this.context.state !== 'running') finish(); };
    this.retirement.add(finish);
    this.context.addEventListener('statechange', onStateChange);
    clock.onended = finish;
    clock.start(now);
    clock.stop(now + PLAYBACK_FADE_SECONDS);
  }

  async stop(): Promise<void> {
    if (this.state !== 'playing') return;
    this.state = 'stopping';
    const now = this.context.currentTime;
    fadeGain(this.master.gain, 0, now);
    await new Promise<void>(resolve => this.afterFade(now, () => {
      for (const finish of this.retirement) finish();
      this.clearPatch();
      resolve();
    }));
    if (this.state === 'stopping') this.state = 'ready';
  }

  private clearPatch(): void {
    for (const cable of this.cables.values()) cable.dispose();
    for (const module of this.modules.values()) module.dispose();
    this.cables.clear();
    this.modules.clear();
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed';
    for (const finish of this.retirement) finish();
    this.clearPatch();
    this.master.disconnect();
    this.protection.dispose();
    this.analyser.disconnect();
    void this.context.close();
  }
}
