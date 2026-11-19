import type { DroneMixSettings, DroneShelfSettings } from '../../domain/drone';
import { fadeGain } from './web-audio-fade';
import { WebAudioReverb } from './web-audio-reverb';

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
  private readonly lowShelf: BiquadFilterNode;
  private readonly highShelf: BiquadFilterNode;
  private readonly reverb: WebAudioReverb;
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
    this.reverb = new WebAudioReverb(context, settings.reverb, output);
    this.lowShelf = this.createShelf('lowshelf', settings.lowShelf);
    this.highShelf = this.createShelf('highshelf', settings.highShelf);
    this.sourceLevel.connect(this.dryGain).connect(this.lowShelf);
    this.sourceLevel.connect(this.filter).connect(this.wetGain).connect(this.lowShelf);
    this.lowShelf.connect(this.highShelf).connect(this.reverb.input);
  }

  fadeSources(start: number, end: number): void {
    this.sourceLevel.gain.setValueAtTime(1, start);
    this.sourceLevel.gain.linearRampToValueAtTime(0, end);
  }

  update(settings: DroneMixSettings, now: number): void {
    this.filter.frequency.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    this.dryGain.gain.setTargetAtTime(settings.filter.enabled ? 0 : 1, now, 0.015);
    this.wetGain.gain.setTargetAtTime(settings.filter.enabled ? 1 : 0, now, 0.015);
    this.updateShelf(this.lowShelf, settings.lowShelf, now);
    this.updateShelf(this.highShelf, settings.highShelf, now);
    this.reverb.update(settings.reverb, now);
    if (settings.noise.enabled && !this.noiseSource) this.startNoise(now);
    fadeGain(this.noiseGain.gain, settings.noise.enabled ? settings.noise.volume * MAX_NOISE_GAIN : 0, now);
  }

  private createShelf(type: 'lowshelf' | 'highshelf', settings: DroneShelfSettings): BiquadFilterNode {
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = this.getShelfFrequency(settings.frequencyHz);
    filter.gain.value = settings.gainDecibels;
    return filter;
  }

  private updateShelf(filter: BiquadFilterNode, settings: DroneShelfSettings, now: number): void {
    filter.frequency.setTargetAtTime(this.getShelfFrequency(settings.frequencyHz), now, 0.02);
    filter.gain.setTargetAtTime(settings.gainDecibels, now, 0.02);
  }

  private getShelfFrequency(frequencyHz: number): number {
    return Math.min(frequencyHz, this.context.sampleRate * 0.49);
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
    this.lowShelf.disconnect();
    this.highShelf.disconnect();
    this.reverb.dispose();
  }
}
