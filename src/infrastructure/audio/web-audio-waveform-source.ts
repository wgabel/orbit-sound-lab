import type { OscillatorSettings, OscillatorWaveform } from '../../domain/drone';
import { applyPitchOffset } from '../../domain/modulation';
import { PLAYBACK_FADE_SECONDS } from './web-audio-fade';

interface OscillatorBranch {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
  readonly fadeInStartedAt: number | null;
}

/** Keeps pitch modulation connected while replacing the waveform generator. */
export class WebAudioWaveformSource {
  readonly output: GainNode;
  readonly detune: AudioParam;
  readonly frequency: AudioParam;
  private readonly sharedFrequency: ConstantSourceNode;
  private readonly sharedDetune: ConstantSourceNode;
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

  start(now: number): void {
    this.current.oscillator.start(now);
    this.sharedDetune.start(now);
    this.sharedFrequency.start(now);
    this.started = true;
  }

  update(waveform: OscillatorWaveform, frequency: number, now: number): void {
    const previous = this.current;
    if (previous.oscillator.type !== waveform) {
      if (this.started) {
        this.current = this.createBranch(waveform, now);
        this.current.oscillator.start(now);
        const end = now + PLAYBACK_FADE_SECONDS;
        this.current.gain.gain.linearRampToValueAtTime(1, end);

        const fadeInStartedAt = previous.fadeInStartedAt;
        const outgoingLevel = fadeInStartedAt === null ? 1 : Math.min(1, (now - fadeInStartedAt) / PLAYBACK_FADE_SECONDS);
        previous.gain.gain.cancelScheduledValues(now);
        previous.gain.gain.setValueAtTime(outgoingLevel, now);
        previous.gain.gain.linearRampToValueAtTime(0, end);
        previous.oscillator.onended = () => this.removeBranch(previous);
        previous.oscillator.stop(end);
      } else {
        previous.oscillator.type = waveform;
      }
    }
    this.frequency.setTargetAtTime(frequency, now, 0.015);
  }

  stop(when: number): void {
    if (this.stopped) return;
    this.stopped = true;
    this.sharedDetune.stop(when);
    this.sharedFrequency.stop(when);
    this.current.oscillator.stop(when);
  }

  dispose(): void {
    if (this.started && !this.stopped) this.stop(this.context.currentTime);
    for (const branch of this.branches) this.removeBranch(branch);
    this.sharedDetune.disconnect();
    this.sharedFrequency.disconnect();
    this.output.disconnect();
  }

  private createBranch(waveform: OscillatorWaveform, fadeInStartedAt: number | null): OscillatorBranch {
    const oscillator = this.context.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.value = 0;
    this.sharedFrequency.connect(oscillator.frequency);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(fadeInStartedAt === null ? 1 : 0, fadeInStartedAt ?? this.context.currentTime);
    this.sharedDetune.connect(oscillator.detune);
    oscillator.connect(gain).connect(this.output);
    const branch = {oscillator, gain, fadeInStartedAt};
    this.branches.add(branch);
    return branch;
  }

  private removeBranch(branch: OscillatorBranch): void {
    branch.oscillator.onended = null;
    this.sharedDetune.disconnect(branch.oscillator.detune);
    this.sharedFrequency.disconnect(branch.oscillator.frequency);
    branch.oscillator.disconnect();
    branch.gain.disconnect();
    this.branches.delete(branch);
  }
}
