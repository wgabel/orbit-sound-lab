import { DEFAULT_CYCLE_ENVELOPE } from '../../domain/cycle-envelope';
import type { CycleEnvelope } from '../../domain/cycle-envelope';
import { readCycleEnvelopeHarmonics } from './cycle-envelope-wave';
import { DEFAULT_OSCILLATOR_SHAPE, MAXIMUM_PULSE_WIDTH, MINIMUM_PULSE_WIDTH } from '../../domain/drone';
import type { OscillatorSettings, OscillatorWaveform } from '../../domain/drone';
import { applyPitchOffset } from '../../domain/modulation';
import type { WebAudioPulseWorkletFactory } from './web-audio-pulse-worklet';
import { analyseFoldedSineHarmonics, PEAKED_SINE_HARMONICS, readOscillatorLoudnessGain } from './oscillator-loudness';
import type { CycleHarmonics } from './oscillator-loudness';
import { CLEAN_FOLD_INPUT_GAIN, SINE_FOLD_CURVE } from './sine-wavefolding';
import { PLAYBACK_FADE_SECONDS } from './web-audio-fade';

function getBaseShape(settings: OscillatorSettings): number {
  const shape = settings.shape ?? DEFAULT_OSCILLATOR_SHAPE;
  return settings.waveform === 'variablePulse' ? Math.max(MINIMUM_PULSE_WIDTH, Math.min(MAXIMUM_PULSE_WIDTH, shape)) : shape;
}

const PEAKED_SINE_COSINE_HARMONICS = new Float32Array(PEAKED_SINE_HARMONICS.length);

interface ShapeControl {
  readonly smoother: BiquadFilterNode;
  readonly boundedShape: WaveShaperNode;
}

interface ShapeBlend {
  readonly secondary: OscillatorNode;
  readonly levels: readonly GainNode[];
}

interface OscillatorBranch {
  readonly clock: AudioScheduledSourceNode;
  readonly frequency: AudioParam;
  readonly detune: AudioParam;
  readonly pulse?: AudioWorkletNode;
  readonly pulseShape?: AudioParam;
  readonly waveform: OscillatorWaveform;
  readonly cycleEnvelope?: CycleEnvelope;
  cycleHarmonics?: CycleHarmonics;
  readonly blend?: ShapeBlend;
  readonly shapeControl?: ShapeControl;
  readonly fold?: {drive: GainNode; amount: GainNode; shaper: WaveShaperNode};
  readonly gain: GainNode;
  readonly loudnessGain: GainNode;
  loudnessPitch: number;
  loudnessShape: number;
  readonly fadeInStartedAt: number | null;
  shapePreview?: {analyser: AnalyserNode; samples: Float32Array<ArrayBuffer>};
}

/** Keeps pitch modulation connected while replacing the waveform generator. */
export class WebAudioWaveformSource {
  readonly output: GainNode;
  /** Keeps the original waveform amplitude for oscillator-to-oscillator routes. */
  readonly modulationOutput: GainNode;
  readonly detune: AudioParam;
  readonly frequency: AudioParam;
  readonly shape: AudioParam;
  private readonly sharedFrequency: ConstantSourceNode;
  private readonly sharedDetune: ConstantSourceNode;
  private readonly sharedShape: ConstantSourceNode;
  private pitchPreview?: {frequency: AnalyserNode; detune: AnalyserNode; samples: Float32Array<ArrayBuffer>};
  private readonly branches = new Set<OscillatorBranch>();
  private current: OscillatorBranch;
  private started = false;
  private stopped = false;

  constructor(private readonly context: AudioContext, settings: OscillatorSettings,
    private readonly pulseWorklet: WebAudioPulseWorkletFactory) {
    this.output = context.createGain();
    this.modulationOutput = context.createGain();
    this.sharedDetune = context.createConstantSource();
    this.detune = this.sharedDetune.offset;
    this.detune.value = settings.detuneCents;
    this.sharedFrequency = context.createConstantSource();
    this.frequency = this.sharedFrequency.offset;
    this.frequency.value = settings.frequencyHz;
    this.sharedShape = context.createConstantSource();
    this.shape = this.sharedShape.offset;
    this.shape.value = getBaseShape(settings);
    this.current = this.createBranch(settings, null);
  }

  get activeClock(): AudioScheduledSourceNode { return this.current.clock; }

  readEffectiveFrequency(): number | null {
    if (!this.started || this.stopped || this.context.state !== 'running') return null;
    if (!this.pitchPreview) {
      const frequency = this.context.createAnalyser();
      const detune = this.context.createAnalyser();
      const samples = new Float32Array(32);
      frequency.fftSize = detune.fftSize = samples.length;
      this.sharedFrequency.connect(frequency);
      this.sharedDetune.connect(detune);
      this.pitchPreview = {frequency, detune, samples};
      return null;
    }
    const {frequency, detune, samples} = this.pitchPreview;
    frequency.getFloatTimeDomainData(samples);
    const frequencyHz = samples[samples.length - 1];
    if (frequencyHz <= 0) return null;
    detune.getFloatTimeDomainData(samples);
    return Math.min(this.context.sampleRate / 2, applyPitchOffset(frequencyHz, samples[samples.length - 1]));
  }

  readEffectiveShape(): number | null {
    const branch = this.current;
    if ((!branch.shapeControl && !branch.pulse) || !this.started || this.stopped || this.context.state !== 'running') return null;
    if (!branch.shapePreview) {
      const analyser = this.context.createAnalyser();
      const samples = new Float32Array(32);
      analyser.fftSize = samples.length;
      (branch.shapeControl?.boundedShape ?? this.sharedShape).connect(analyser);
      branch.shapePreview = {analyser, samples};
      return null;
    }
    const {analyser, samples} = branch.shapePreview;
    analyser.getFloatTimeDomainData(samples);
    const shape = samples[samples.length - 1];
    return branch.pulse ? Math.max(MINIMUM_PULSE_WIDTH, Math.min(MAXIMUM_PULSE_WIDTH, shape)) : shape;
  }

  start(now: number): void {
    this.startBranch(this.current, now);
    this.sharedDetune.start(now);
    this.sharedFrequency.start(now);
    this.sharedShape.start(now);
    this.started = true;
  }

  update(settings: OscillatorSettings, now: number): void {
    const previous = this.current;
    const cycleEnvelope = settings.waveform === 'cycleEnvelope' ? settings.cycleEnvelope ?? DEFAULT_CYCLE_ENVELOPE : undefined;
    if (previous.waveform !== settings.waveform || previous.cycleEnvelope !== cycleEnvelope) {
      this.current = this.createBranch(settings, this.started ? now : null);
      if (this.started) {
        this.startBranch(this.current, now);
        const end = now + PLAYBACK_FADE_SECONDS;
        this.current.gain.gain.linearRampToValueAtTime(1, end);

        const fadeInStartedAt = previous.fadeInStartedAt;
        const outgoingLevel = fadeInStartedAt === null ? 1 : Math.min(1, (now - fadeInStartedAt) / PLAYBACK_FADE_SECONDS);
        previous.gain.gain.cancelScheduledValues(now);
        previous.gain.gain.setValueAtTime(outgoingLevel, now);
        previous.gain.gain.linearRampToValueAtTime(0, end);
        previous.clock.onended = () => this.removeBranch(previous);
        this.stopBranch(previous, end);
      } else {
        this.removeBranch(previous);
      }
    } else {
      this.updateLoudness(previous, settings, now);
    }
    this.frequency.setTargetAtTime(settings.frequencyHz, now, 0.015);
    this.shape.setTargetAtTime(getBaseShape(settings), now, 0.015);
  }

  private startBranch(branch: OscillatorBranch, when: number): void {
    branch.clock.start(when);
    branch.blend?.secondary.start(when);
  }

  private stopBranch(branch: OscillatorBranch, when: number): void {
    branch.clock.stop(when);
    branch.blend?.secondary.stop(when);
  }

  stop(when: number): void {
    if (this.stopped) return;
    this.stopped = true;
    this.sharedDetune.stop(when);
    this.sharedFrequency.stop(when);
    this.sharedShape.stop(when);
    this.stopBranch(this.current, when);
  }

  dispose(): void {
    if (this.started && !this.stopped) this.stop(this.context.currentTime);
    for (const branch of this.branches) this.removeBranch(branch);
    this.sharedDetune.disconnect();
    this.sharedFrequency.disconnect();
    this.sharedShape.disconnect();
    this.output.disconnect();
    this.modulationOutput.disconnect();
  }

  private updateLoudness(branch: OscillatorBranch, settings: OscillatorSettings, now?: number): void {
    const pitch = applyPitchOffset(settings.frequencyHz, settings.detuneCents);
    const shape = getBaseShape(settings);
    const shapeChanged = branch.loudnessShape !== shape;
    if (branch.loudnessPitch === pitch && !shapeChanged) return;
    if (shapeChanged && branch.waveform === 'foldedSine') branch.cycleHarmonics = analyseFoldedSineHarmonics(shape);
    branch.loudnessPitch = pitch;
    branch.loudnessShape = shape;
    const gain = readOscillatorLoudnessGain(branch.waveform, pitch, shape, this.context.sampleRate, branch.cycleHarmonics);
    if (now === undefined) branch.loudnessGain.gain.value = gain;
    else branch.loudnessGain.gain.setTargetAtTime(gain, now, 0.015);
  }

  private createBranch(settings: OscillatorSettings, fadeInStartedAt: number | null): OscillatorBranch {
    const {waveform} = settings;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(fadeInStartedAt === null ? 1 : 0, fadeInStartedAt ?? this.context.currentTime);
    const generator = waveform === 'variablePulse' ?
      this.createPulseBranch(this.pulseWorklet.create(), gain, fadeInStartedAt) : this.createNativeBranch(waveform, gain, fadeInStartedAt, settings.cycleEnvelope ?? DEFAULT_CYCLE_ENVELOPE);
    const loudnessGain = this.context.createGain();
    const branch = {...generator, loudnessGain, loudnessPitch:0, loudnessShape:-1};
    this.updateLoudness(branch, settings);
    gain.connect(loudnessGain).connect(this.output);
    gain.connect(this.modulationOutput);
    this.branches.add(branch);
    return branch;
  }

  private createPulseBranch(pulse: AudioWorkletNode, gain: GainNode, fadeInStartedAt: number | null) {
    const frequency = pulse.parameters.get('frequency');
    const detune = pulse.parameters.get('detune');
    const pulseShape = pulse.parameters.get('shape');
    const gate = pulse.parameters.get('gate');
    if (!frequency || !detune || !pulseShape || !gate) throw new Error('Variable Pulse could not initialize.');
    const clock = this.context.createConstantSource();
    // A scheduled gate and native ended event share the context clock with the other waveforms.
    clock.connect(gate);
    this.sharedFrequency.connect(frequency);
    this.sharedDetune.connect(detune);
    this.sharedShape.connect(pulseShape);
    pulse.connect(gain);
    return {clock, waveform: 'variablePulse' as const, gain, frequency, detune, pulse, pulseShape, fadeInStartedAt};
  }

  private createNativeBranch(waveform: Exclude<OscillatorWaveform, 'variablePulse'>,
    gain: GainNode, fadeInStartedAt: number | null, cycleEnvelope: CycleEnvelope) {
    const oscillator = this.createOscillator(waveform === 'sineTriangle' || waveform === 'foldedSine' || waveform === 'peakedSine' || waveform === 'cycleEnvelope' ? 'sine' : waveform);
    const branch = {clock: oscillator, waveform, gain, frequency: oscillator.frequency, detune: oscillator.detune, fadeInStartedAt};
    if (waveform === 'cycleEnvelope') {
      const shapeControl = this.createShapeControl();
      const secondary = this.createOscillator('sine');
      const cycleHarmonics = readCycleEnvelopeHarmonics(cycleEnvelope);
      secondary.setPeriodicWave(this.context.createPeriodicWave(cycleHarmonics.cosine,cycleHarmonics.sine,{disableNormalization:true}));
      return {...branch, cycleEnvelope, cycleHarmonics, shapeControl, blend: this.createShapeBlend(oscillator,secondary,gain,shapeControl.boundedShape)};
    }
    if (waveform === 'sineTriangle' || waveform === 'peakedSine') {
      const shapeControl = this.createShapeControl();
      const secondary = waveform === 'peakedSine' ? this.createPeakedSineOscillator() : this.createOscillator('triangle');
      return {...branch, shapeControl, blend: this.createShapeBlend(oscillator, secondary, gain, shapeControl.boundedShape)};
    }
    if (waveform === 'foldedSine') {
      const shapeControl = this.createShapeControl();
      return {...branch, shapeControl, fold: this.createFold(oscillator, gain, shapeControl.boundedShape)};
    }
    oscillator.connect(gain);
    return branch;
  }

  private createPeakedSineOscillator(): OscillatorNode {
    const oscillator = this.createOscillator('sine');
    oscillator.setPeriodicWave(this.context.createPeriodicWave(PEAKED_SINE_COSINE_HARMONICS,PEAKED_SINE_HARMONICS,
      {disableNormalization:true}));
    return oscillator;
  }

  private createOscillator(waveform: Exclude<OscillatorWaveform, 'sineTriangle' | 'variablePulse' | 'foldedSine' | 'peakedSine' | 'cycleEnvelope'>): OscillatorNode {
    const oscillator = this.context.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.value = 0;
    this.sharedFrequency.connect(oscillator.frequency);
    this.sharedDetune.connect(oscillator.detune);
    return oscillator;
  }

  private createShapeControl(): ShapeControl {
    const smoother = this.context.createBiquadFilter();
    const boundedShape = this.context.createWaveShaper();
    smoother.type = 'lowpass';
    smoother.frequency.value = 120;
    smoother.Q.value = 20 * Math.log10(0.5);
    boundedShape.curve = new Float32Array([0, 0, 1]);
    this.sharedShape.connect(smoother).connect(boundedShape);
    return {smoother, boundedShape};
  }

  private createShapeBlend(sine: OscillatorNode, secondary: OscillatorNode, output: GainNode, boundedShape: AudioNode): ShapeBlend {
    const sineLevel = this.context.createGain();
    const secondaryLevel = this.context.createGain();
    const invert = this.context.createGain();
    sineLevel.gain.value = 1;
    secondaryLevel.gain.value = 0;
    invert.gain.value = -1;
    // The two gains always sum to one, including when modulation hits a boundary.
    boundedShape.connect(secondaryLevel.gain);
    boundedShape.connect(invert).connect(sineLevel.gain);
    sine.connect(sineLevel).connect(output);
    secondary.connect(secondaryLevel).connect(output);
    return {secondary, levels: [sineLevel, secondaryLevel, invert]};
  }

  private createFold(sine: OscillatorNode, output: GainNode, boundedShape: AudioNode) {
    const drive = this.context.createGain();
    drive.gain.value = CLEAN_FOLD_INPUT_GAIN;
    const amount = this.context.createGain();
    amount.gain.value = 1 - CLEAN_FOLD_INPUT_GAIN;
    const shaper = this.context.createWaveShaper();
    shaper.curve = SINE_FOLD_CURVE;
    shaper.oversample = '4x';
    boundedShape.connect(amount).connect(drive.gain);
    sine.connect(drive).connect(shaper).connect(output);
    return {drive, amount, shaper};
  }

  private disconnectOscillator(oscillator: OscillatorNode): void {
    this.sharedDetune.disconnect(oscillator.detune);
    this.sharedFrequency.disconnect(oscillator.frequency);
    oscillator.disconnect();
  }

  private removeBranch(branch: OscillatorBranch): void {
    branch.clock.onended = null;
    this.sharedDetune.disconnect(branch.detune);
    this.sharedFrequency.disconnect(branch.frequency);
    branch.clock.disconnect();
    if (branch.pulse && branch.pulseShape) {
      this.sharedShape.disconnect(branch.pulseShape);
      branch.pulse.port.postMessage('stop');
      branch.pulse.disconnect();
      if (branch.shapePreview) this.sharedShape.disconnect(branch.shapePreview.analyser);
    }
    branch.shapePreview?.analyser.disconnect();
    const {blend} = branch;
    if (blend) {
      this.disconnectOscillator(blend.secondary);
      for (const level of blend.levels) level.disconnect();
    }
    if (branch.shapeControl) {
      this.sharedShape.disconnect(branch.shapeControl.smoother);
      branch.shapeControl.smoother.disconnect();
      branch.shapeControl.boundedShape.disconnect();
    }
    if (branch.fold) {
      branch.fold.drive.disconnect();
      branch.fold.amount.disconnect();
      branch.fold.shaper.disconnect();
    }
    branch.gain.disconnect();
    branch.loudnessGain.disconnect();
    this.branches.delete(branch);
  }
}
