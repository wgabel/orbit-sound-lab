import type { PerformancePosition } from '@domain/performance-pad';
import { getPerformanceMix } from '@domain/performance-pad';

const SMOOTHING_SECONDS = 0.015;
const BUTTERWORTH_RESONANCE_DECIBELS = 20 * Math.log10(Math.SQRT1_2);

export class WebAudioPerformanceMix {
  readonly inputA: GainNode;
  readonly inputB: GainNode;
  readonly output: GainNode;
  private readonly sum: GainNode;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private readonly filter: BiquadFilterNode;

  constructor(private readonly context: AudioContext) {
    this.inputA = context.createGain();
    this.inputB = context.createGain();
    this.output = context.createGain();
    this.sum = context.createGain();
    this.dry = context.createGain();
    this.wet = context.createGain();
    this.wet.gain.value = 0;
    this.filter = context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = BUTTERWORTH_RESONANCE_DECIBELS;
    this.filter.frequency.value = Math.min(18000, context.sampleRate * 0.4);

    this.inputA.connect(this.sum);
    this.inputB.connect(this.sum);
    this.sum.connect(this.dry).connect(this.output);
    this.sum.connect(this.filter).connect(this.wet).connect(this.output);
  }

  setPosition(position: PerformancePosition): void {
    const {levelA, levelB, cutoffHz, filterMix} = getPerformanceMix(position, this.context.sampleRate);
    const now = this.context.currentTime;
    this.inputA.gain.setTargetAtTime(levelA, now, SMOOTHING_SECONDS);
    this.inputB.gain.setTargetAtTime(levelB, now, SMOOTHING_SECONDS);
    this.filter.frequency.setTargetAtTime(cutoffHz, now, SMOOTHING_SECONDS);
    this.dry.gain.setTargetAtTime(1 - filterMix, now, SMOOTHING_SECONDS);
    this.wet.gain.setTargetAtTime(filterMix, now, SMOOTHING_SECONDS);
  }

  dispose(): void {
    for (const node of [this.inputA, this.inputB, this.sum, this.dry, this.wet, this.filter, this.output]) node.disconnect();
  }
}
