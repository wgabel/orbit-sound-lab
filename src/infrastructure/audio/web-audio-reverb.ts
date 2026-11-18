import type { DroneReverbSettings } from '../../domain/drone';

const IMPULSE_SECONDS = 1.8;
const PRE_DELAY_SECONDS = 0.018;
const BLEND_TIME_CONSTANT_SECONDS = 0.015;

export class WebAudioReverb {
  readonly input: GainNode;
  private readonly dryGain: GainNode;
  private readonly wetGain: GainNode;
  private convolver: ConvolverNode | null = null;

  constructor(private readonly context: AudioContext, settings: DroneReverbSettings, output: AudioNode) {
    this.input = context.createGain();
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();
    const mix = settings.enabled ? settings.mix : 0;
    this.dryGain.gain.value = 1 - mix;
    this.wetGain.gain.value = mix;
    this.input.connect(this.dryGain).connect(output);
    this.wetGain.connect(output);
  }

  update(settings: DroneReverbSettings, now: number): void {
    const mix = settings.enabled ? settings.mix : 0;
    if (mix > 0 && !this.convolver) this.connectConvolver();
    this.dryGain.gain.setTargetAtTime(1 - mix, now, BLEND_TIME_CONSTANT_SECONDS);
    this.wetGain.gain.setTargetAtTime(mix, now, BLEND_TIME_CONSTANT_SECONDS);
  }

  private connectConvolver(): void {
    const { sampleRate } = this.context;
    const preDelay = Math.round(PRE_DELAY_SECONDS * sampleRate);
    const tailLength = Math.round(IMPULSE_SECONDS * sampleRate);
    const impulse = this.context.createBuffer(2, preDelay + tailLength, sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const samples = impulse.getChannelData(channel);
      let softenedNoise = 0;
      for (let index = 0; index < tailLength; index++) {
        softenedNoise = 0.55 * softenedNoise + 0.45 * (Math.random() * 2 - 1);
        const envelope = (1 - index / tailLength) ** 3;
        samples[preDelay + index] = softenedNoise * envelope;
      }
    }
    const convolver = this.context.createConvolver();
    convolver.buffer = impulse;
    this.input.connect(convolver).connect(this.wetGain);
    this.convolver = convolver;
  }

  dispose(): void {
    this.input.disconnect();
    this.dryGain.disconnect();
    this.convolver?.disconnect();
    this.wetGain.disconnect();
  }
}
