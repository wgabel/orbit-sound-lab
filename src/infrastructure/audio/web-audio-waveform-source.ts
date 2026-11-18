import { DEFAULT_OSCILLATOR_SHAPE } from '../../domain/drone';
import type { OscillatorSettings, OscillatorWaveform } from '../../domain/drone';
import { applyPitchOffset } from '../../domain/modulation';
import { PLAYBACK_FADE_SECONDS } from './web-audio-fade';

interface ShapeBlend {
  readonly triangle: OscillatorNode;
  readonly smoother: BiquadFilterNode;
  readonly boundedShape: WaveShaperNode;
  readonly levels: readonly GainNode[];
  preview?: {analyser: AnalyserNode; samples: Float32Array<ArrayBuffer>};
}

interface OscillatorBranch {
  readonly oscillator: OscillatorNode;
  readonly waveform: OscillatorWaveform;
  readonly blend?: ShapeBlend;
  readonly gain: GainNode;
  readonly fadeInStartedAt: number | null;
}

/** Keeps pitch modulation connected while replacing the waveform generator. */
export class WebAudioWaveformSource {
  readonly output: GainNode;
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

  constructor(private readonly context: AudioContext, settings: OscillatorSettings) {
    this.output = context.createGain();
    this.sharedDetune = context.createConstantSource();
    this.detune = this.sharedDetune.offset;
    this.detune.value = settings.detuneCents;
    this.sharedFrequency = context.createConstantSource();
    this.frequency = this.sharedFrequency.offset;
    this.frequency.value = settings.frequencyHz;
    this.sharedShape = context.createConstantSource();
    this.shape = this.sharedShape.offset;
    this.shape.value = settings.shape ?? DEFAULT_OSCILLATOR_SHAPE;
    this.current = this.createBranch(settings.waveform, null);
  }

  get activeOscillator(): OscillatorNode { return this.current.oscillator; }

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
    const blend = this.current.blend;
    if (!blend || !this.started || this.stopped || this.context.state !== 'running') return null;
    if (!blend.preview) {
      const analyser = this.context.createAnalyser();
      const samples = new Float32Array(32);
      analyser.fftSize = samples.length;
      blend.boundedShape.connect(analyser);
      blend.preview = {analyser, samples};
      return null;
    }
    const {analyser, samples} = blend.preview;
    analyser.getFloatTimeDomainData(samples);
    return samples[samples.length - 1];
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
    if (previous.waveform !== settings.waveform) {
      this.current = this.createBranch(settings.waveform, this.started ? now : null);
      if (this.started) {
        this.startBranch(this.current, now);
        const end = now + PLAYBACK_FADE_SECONDS;
        this.current.gain.gain.linearRampToValueAtTime(1, end);

        const fadeInStartedAt = previous.fadeInStartedAt;
        const outgoingLevel = fadeInStartedAt === null ? 1 : Math.min(1, (now - fadeInStartedAt) / PLAYBACK_FADE_SECONDS);
        previous.gain.gain.cancelScheduledValues(now);
        previous.gain.gain.setValueAtTime(outgoingLevel, now);
        previous.gain.gain.linearRampToValueAtTime(0, end);
        previous.oscillator.onended = () => this.removeBranch(previous);
        this.stopBranch(previous, end);
      } else {
        this.removeBranch(previous);
      }
    }
    this.frequency.setTargetAtTime(settings.frequencyHz, now, 0.015);
    this.shape.setTargetAtTime(settings.shape ?? DEFAULT_OSCILLATOR_SHAPE, now, 0.015);
  }

  private startBranch(branch: OscillatorBranch, when: number): void {
    branch.oscillator.start(when);
    branch.blend?.triangle.start(when);
  }

  private stopBranch(branch: OscillatorBranch, when: number): void {
    branch.oscillator.stop(when);
    branch.blend?.triangle.stop(when);
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
  }

  private createBranch(waveform: OscillatorWaveform, fadeInStartedAt: number | null): OscillatorBranch {
    const oscillator = this.createOscillator(waveform === 'sineTriangle' ? 'sine' : waveform);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(fadeInStartedAt === null ? 1 : 0, fadeInStartedAt ?? this.context.currentTime);
    const blend = waveform === 'sineTriangle' ? this.createShapeBlend(oscillator, gain) : undefined;
    if (!blend) oscillator.connect(gain);
    gain.connect(this.output);
    const branch = {oscillator, waveform, blend, gain, fadeInStartedAt};
    this.branches.add(branch);
    return branch;
  }

  private createOscillator(waveform: Exclude<OscillatorWaveform, 'sineTriangle'>): OscillatorNode {
    const oscillator = this.context.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.value = 0;
    this.sharedFrequency.connect(oscillator.frequency);
    this.sharedDetune.connect(oscillator.detune);
    return oscillator;
  }

  private createShapeBlend(sine: OscillatorNode, output: GainNode): ShapeBlend {
    const triangle = this.createOscillator('triangle');
    const sineLevel = this.context.createGain();
    const triangleLevel = this.context.createGain();
    const invert = this.context.createGain();
    const smoother = this.context.createBiquadFilter();
    const boundedShape = this.context.createWaveShaper();
    sineLevel.gain.value = 1;
    triangleLevel.gain.value = 0;
    invert.gain.value = -1;
    smoother.type = 'lowpass';
    smoother.frequency.value = 120;
    smoother.Q.value = 20 * Math.log10(0.5);
    boundedShape.curve = new Float32Array([0, 0, 1]);
    this.sharedShape.connect(smoother).connect(boundedShape);
    // The two gains always sum to one, including when modulation hits a boundary.
    boundedShape.connect(triangleLevel.gain);
    boundedShape.connect(invert).connect(sineLevel.gain);
    sine.connect(sineLevel).connect(output);
    triangle.connect(triangleLevel).connect(output);
    return {triangle, smoother, boundedShape, levels: [sineLevel, triangleLevel, invert]};
  }

  private disconnectOscillator(oscillator: OscillatorNode): void {
    this.sharedDetune.disconnect(oscillator.detune);
    this.sharedFrequency.disconnect(oscillator.frequency);
    oscillator.disconnect();
  }

  private removeBranch(branch: OscillatorBranch): void {
    branch.oscillator.onended = null;
    this.disconnectOscillator(branch.oscillator);
    const {blend} = branch;
    if (blend) {
      this.disconnectOscillator(blend.triangle);
      this.sharedShape.disconnect(blend.smoother);
      blend.smoother.disconnect();
      blend.boundedShape.disconnect();
      blend.preview?.analyser.disconnect();
      for (const level of blend.levels) level.disconnect();
    }
    branch.gain.disconnect();
    this.branches.delete(branch);
  }
}
