import { WebAudioSimplexNoiseFactory } from './web-audio-simplex-noise';
import { WebAudioAutomationTimingFactory } from './web-audio-automation-timing';
import { WebAudioPitchShiftWorkletFactory } from './web-audio-pitch-shift-worklet';
import { isArrangementTrack, readArrangementEnd, readPatchArrangement } from '../../domain/patch-arrangement';
import type { ArrangementClip, PatchArrangement } from '../../domain/patch-arrangement';
import { scheduleClipGates } from './web-audio-patch-arrangement';
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
  const start = definition.inverted ? mapping.to : mapping.from;
  const end = definition.inverted ? mapping.from : mapping.to;
  const from = binding.constrain?.(start) ?? start;
  const to = binding.constrain?.(end) ?? end;
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
  private readonly simplexNoise: WebAudioSimplexNoiseFactory;
  private readonly lfo: WebAudioLfoWorkletFactory;
  private readonly modulationFactory: WebAudioLowFrequencyOscillatorFactory;
  private readonly pulse: WebAudioPulseWorkletFactory;
  private readonly pitchShift: WebAudioPitchShiftWorkletFactory;
  private readonly automationTiming: WebAudioAutomationTimingFactory;
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
  private arrangement?: {readonly tracks: ReadonlyMap<string, ArrangementClip[]>; readonly from: number};
  private state: 'ready' | 'starting' | 'playing' | 'stopping' | 'disposed' = 'ready';

  constructor(private readonly context: AudioContext) {
    this.pulse = new WebAudioPulseWorkletFactory(context);
    this.pitchShift = new WebAudioPitchShiftWorkletFactory(context);
    this.automationTiming = new WebAudioAutomationTimingFactory(context);
    this.lfo = new WebAudioLfoWorkletFactory(context);
    this.simplexNoise = new WebAudioSimplexNoiseFactory(context);
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

  async start(patch: Patch, arrangement?: {readonly plan: PatchArrangement; readonly from: number}): Promise<void> {
    if (this.state !== 'ready') throw new Error('Patch playback is busy.');
    validatePatch(patch);
    const plan = arrangement && readPatchArrangement(arrangement.plan,patch);
    const end = plan ? readArrangementEnd(plan) + plan.tail : 0;
    const from = arrangement?.from ?? 0;
    if (plan && (!plan.clips.length || !Number.isFinite(from) || from < 0 || from >= end)) {
      throw new Error('Choose a playback point before the arrangement ends and add at least one clip.');
    }
    this.state = 'starting';
    try {
      await Promise.all([this.context.resume(), this.pulse.prepare(), this.lfo.prepare(), this.pitchShift.prepare(), this.automationTiming.prepare(), this.simplexNoise.prepare()]);
      if (!this.isStarting()) return;
      this.origin = this.context.currentTime - from;
      this.audibleElapsed = from;
      if (plan) {
        const tracks = new Map(patch.modules.filter(isArrangementTrack).map(module => [module.id,[] as ArrangementClip[]]));
        for (const clip of plan.clips) tracks.get(clip.moduleId)?.push(clip);
        this.arrangement = {tracks,from};
      }
      this.applyPatch(patch);
      const now = this.context.currentTime;
      if (plan) {
        const endTime = this.origin + end;
        const fade = Math.min(PLAYBACK_FADE_SECONDS,Math.max(0,endTime-now)/2);
        if (fade > 0) {
          this.master.gain.setValueAtTime(0,now);
          this.master.gain.linearRampToValueAtTime(0.8,now+fade);
          this.master.gain.setValueAtTime(0.8,endTime-fade);
          this.master.gain.linearRampToValueAtTime(0,endTime);
        }
      } else fadeGain(this.master.gain,0.8,this.origin);
      this.state = 'playing';
    } catch (error) {
      if (this.isStarting()) {
        this.clearPatch();
        this.state = 'ready';
      }
      throw error;
    }
  }

  private isStarting(): boolean { return this.state === 'starting'; }

  update(patch: Patch): void {
    validatePatch(patch);
    if (this.state === 'playing' && this.arrangement) throw new Error('Stop the arrangement before editing the patch.');
    if (this.state === 'playing') this.applyPatch(patch);
  }

  readAudibleElapsed(): number {
    if (this.state !== 'playing') return 0;
    if (this.context.state === 'running') {
      const outputTime = readOutputContextTime(this.context, performance.now());
      this.audibleElapsed = Math.max(this.arrangement?.from ?? 0, outputTime - this.origin - this.protection.lookaheadSeconds);
    }
    return this.audibleElapsed;
  }

  readLfoPhase(moduleId: string, elapsed: number) {
    if (this.state === 'playing') return this.modules.get(moduleId)?.readLfoPhase?.(elapsed);
  }

  readAutomationTiming(moduleId: string, elapsed: number) {
    if (this.state === 'playing') return this.modules.get(moduleId)?.readAutomationTiming?.(elapsed);
  }

  readControlValue(moduleId: string) {
    if (this.state === 'playing') return this.modules.get(moduleId)?.readControlValue?.();
  }

  getWaveformAnalyser(moduleId: string): AnalyserNode | null {
    return this.state === 'playing' ? this.modules.get(moduleId)?.waveformAnalyser ?? null : null;
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
    const progressionSources = new Map(patch.modules.filter(module => module.kind === 'chordProgression')
      .map(module => [module.id,module.settings]));
    const progressions = new Map(patch.cables.filter(cable => cable.destination.portId === 'chords' && cable.enabled !== false)
      .map(cable => [cable.destination.moduleId,cable.source.moduleId]));
    const automatedPitch = new Set(patch.cables.filter(cable => cable.destination.portId === 'semitones' && cable.enabled !== false)
      .map(cable => cable.destination.moduleId));
    const durations = new Set<string>();
    const stepCounts = new Set<string>();
    for (const {destination,enabled} of patch.cables) {
      const {moduleId,portId} = destination;
      // Keep a connected timing processor running when its cable is temporarily switched off.
      if (enabled === false && !this.modules.get(moduleId)?.parameters?.[portId]) continue;
      if (portId === 'duration') durations.add(moduleId);
      if (portId === 'steps') stepCounts.add(moduleId);
    }
    try {
      for (const definition of patch.modules) {
        const previous = this.modules.get(definition.id);
        const progressionId = progressions.get(definition.id);
        const settings = progressionId === undefined ? undefined : progressionSources.get(progressionId);
        const chordRoute = settings && progressionId !== undefined
          ? {settings,clips:this.arrangement?.tracks.get(progressionId)} : undefined;
        const pitchWorklet = automatedPitch.has(definition.id) ? this.pitchShift : undefined;
        const duration = durations.has(definition.id);
        const steps = stepCounts.has(definition.id);
        const automationTiming = duration || steps ? {factory:this.automationTiming,duration,steps} : undefined;
        const canReuse = previous?.definition === definition && previous.chordProgression === settings &&
          Boolean(previous.parameters?.semitones) === Boolean(pitchWorklet) &&
          Boolean(previous.parameters?.duration) === duration && Boolean(previous.parameters?.steps) === steps;
        const module = canReuse ? previous :
          createPatchRuntimeModule(this.context,definition,this.pulse,this.modulationFactory,this.lfo,this.simplexNoise,this.master,this.origin,{
            clips:this.arrangement?.tracks.get(definition.id),chordRoute,pitchWorklet,automationTiming
          });
        if (module !== previous) createdModules.push(module);
        nextModules.set(definition.id, module);
      }
      for (const definition of patch.cables) {
        if (definition.enabled === false || definition.destination.portId === 'chords') continue;
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
    const immediate = hasPatchCycle([...nextCables.values(), ...overlaps].map(cable => cable.definition));
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
      const clips = this.arrangement?.tracks.get(cable.definition.source.moduleId);
      if (clips) scheduleClipGates(cable.level.gain,clips,this.origin,now);
      else fadeGain(cable.level.gain, 1, now);
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
    this.arrangement = undefined;
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
