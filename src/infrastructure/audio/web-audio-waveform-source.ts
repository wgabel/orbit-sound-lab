import type { OscillatorSettings, OscillatorWaveform } from '../../domain/drone';
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
  private readonly sharedDetune: ConstantSourceNode;
  private readonly branches = new Set<OscillatorBranch>();
  private current: OscillatorBranch;
  private started = false;
  private stopped = false;

  constructor(private readonly context: AudioContext, settings: OscillatorSettings) {
    this.output = context.createGain();
    this.sharedDetune = context.createConstantSource();
    this.detune = this.sharedDetune.offset;
    this.detune.value = settings.detuneCents;
    this.current = this.createBranch(settings.waveform, settings.frequencyHz, null);
  }

  get activeOscillator(): OscillatorNode { return this.current.oscillator; }

  start(now: number): void {
    this.current.oscillator.start(now);
    this.sharedDetune.start(now);
    this.started = true;
  }

  update(waveform: OscillatorWaveform, frequency: number, now: number): void {
    const previous = this.current;
    if (previous.oscillator.type !== waveform) {
      if (this.started) {
        this.current = this.createBranch(waveform, previous.oscillator.frequency.value, now);
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
    for (const branch of this.branches) branch.oscillator.frequency.setTargetAtTime(frequency, now, 0.015);
  }

  stop(when: number): void {
    if (this.stopped) return;
    this.stopped = true;
    this.sharedDetune.stop(when);
    this.current.oscillator.stop(when);
  }

  dispose(): void {
    if (this.started && !this.stopped) this.stop(this.context.currentTime);
    for (const branch of this.branches) this.removeBranch(branch);
    this.sharedDetune.disconnect();
    this.output.disconnect();
  }

  private createBranch(waveform: OscillatorWaveform, frequency: number, fadeInStartedAt: number | null): OscillatorBranch {
    const oscillator = this.context.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.value = frequency;
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
    branch.oscillator.disconnect();
    branch.gain.disconnect();
    this.branches.delete(branch);
  }
}
