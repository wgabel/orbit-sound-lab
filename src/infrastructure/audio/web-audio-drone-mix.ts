import type { DroneMixSettings } from '../../domain/drone';
import { WebAudioDroneEffects } from './web-audio-drone-effects';
import { fadeGain } from './web-audio-fade';

const NOISE_BUFFER_SECONDS = 4;
// Match the maximum per-channel peak of one full-level centered oscillator.
const MAX_NOISE_GAIN = 0.2 / Math.SQRT2;
const BUTTERWORTH_RESONANCE_DECIBELS = 20 * Math.log10(Math.SQRT1_2);

export class WebAudioDroneMix {
  readonly input: GainNode;
  private readonly sourceLevel: GainNode;
  private readonly noiseGain: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly dryGain: GainNode;
  private readonly wetGain: GainNode;
  private readonly effects: WebAudioDroneEffects;
  private noiseSource: AudioBufferSourceNode | null = null;

  constructor(private readonly context: AudioContext, settings: DroneMixSettings, output: AudioNode) {
    this.input = context.createGain();
    this.sourceLevel = context.createGain();
    this.input.connect(this.sourceLevel);
    this.noiseGain = context.createGain();
    this.noiseGain.gain.value = 0;
    this.noiseGain.connect(this.input);
    this.filter = context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = settings.filter.cutoffHz;
    this.filter.Q.value = BUTTERWORTH_RESONANCE_DECIBELS;
    this.dryGain = context.createGain();
    this.dryGain.gain.value = settings.filter.enabled ? 0 : 1;
    this.wetGain = context.createGain();
    this.wetGain.gain.value = settings.filter.enabled ? 1 : 0;
    this.effects = new WebAudioDroneEffects(context,settings,output);
    this.sourceLevel.connect(this.dryGain).connect(this.effects.input);
    this.sourceLevel.connect(this.filter).connect(this.wetGain).connect(this.effects.input);
  }

  fadeSources(start: number, end: number): void {
    this.sourceLevel.gain.setValueAtTime(1, start);
    this.sourceLevel.gain.linearRampToValueAtTime(0, end);
  }

  update(settings: DroneMixSettings, now: number): void {
    this.filter.frequency.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    this.dryGain.gain.setTargetAtTime(settings.filter.enabled ? 0 : 1, now, 0.015);
    this.wetGain.gain.setTargetAtTime(settings.filter.enabled ? 1 : 0, now, 0.015);
    this.effects.update(settings,now);
    if (settings.noise.enabled && !this.noiseSource) this.startNoise(now);
    fadeGain(this.noiseGain.gain, settings.noise.enabled ? settings.noise.volume * MAX_NOISE_GAIN : 0, now);
  }

  private startNoise(now: number): void {
    const rate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, rate * NOISE_BUFFER_SECONDS, rate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = 2 * Math.random() - 1;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.noiseGain);
    source.start(now);
    this.noiseSource = source;
  }

  stop(now: number, end: number): void {
    if (end > now) fadeGain(this.noiseGain.gain, 0, now);
    this.noiseSource?.stop(end);
  }

  dispose(): void {
    this.noiseSource?.stop();
    this.noiseSource?.disconnect();
    this.noiseSource = null;
    this.noiseGain.disconnect();
    this.input.disconnect();
    this.sourceLevel.disconnect();
    this.dryGain.disconnect();
    this.filter.disconnect();
    this.wetGain.disconnect();
    this.effects.dispose();
  }
}
