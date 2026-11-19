import { MAXIMUM_REVERB_PRE_DELAY_MILLISECONDS, resolveReverb } from '../../domain/reverb';
import type { DroneReverbSettings, ReverbSpace } from '../../domain/reverb';

const BLEND_TIME_CONSTANT_SECONDS = 0.015;
const RESPONSE_CROSSFADE_SECONDS = 0.05;
const RESPONSE_EDIT_DELAY_MILLISECONDS = 120;

interface ReverbResponse {
  readonly convolver: ConvolverNode;
  readonly level: GainNode;
}

export class WebAudioReverb {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly dryGain: GainNode;
  private readonly wetGain: GainNode;
  private readonly preDelay: DelayNode;
  private readonly noiseSeed = Math.floor(Math.random() * 2 ** 32);
  private space: ReverbSpace;
  private response: ReverbResponse | undefined;
  private outgoingResponse: ReverbResponse | undefined;
  private responseTimer: ReturnType<typeof setTimeout> | undefined;
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  private mixControl: ConstantSourceNode | undefined;
  private mixWeights: WaveShaperNode[] = [];

  constructor(private readonly context: AudioContext, settings: DroneReverbSettings) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();
    this.preDelay = context.createDelay(MAXIMUM_REVERB_PRE_DELAY_MILLISECONDS / 1000);
    this.space = resolveReverb(settings);
    this.preDelay.delayTime.value = this.space.preDelayMilliseconds / 1000;
    const mix = settings.enabled ? settings.mix : 0;
    this.dryGain.gain.value = 1 - mix;
    this.wetGain.gain.value = mix;
    this.input.connect(this.dryGain).connect(this.output);
    this.input.connect(this.preDelay);
    this.wetGain.connect(this.output);
    if (mix > 0) this.replaceResponse();
  }

  enableMixAutomation(initialMix: number): AudioParam {
    if (!this.response) this.replaceResponse();
    const mix = this.context.createConstantSource();
    mix.offset.value = initialMix;
    const dryWeight = this.context.createWaveShaper();
    const wetWeight = this.context.createWaveShaper();
    // The positive half maps a 0–1 control to complementary dry and wet gains.
    dryWeight.curve = new Float32Array([1,1,0]);
    wetWeight.curve = new Float32Array([0,0,1]);
    this.dryGain.gain.value = 0;
    this.wetGain.gain.value = 0;
    mix.connect(dryWeight).connect(this.dryGain.gain);
    mix.connect(wetWeight).connect(this.wetGain.gain);
    mix.start();
    this.mixControl = mix;
    this.mixWeights = [dryWeight,wetWeight];
    return mix.offset;
  }

  update(settings: DroneReverbSettings, now: number): void {
    const space = resolveReverb(settings);
    const responseChanged = space.decaySeconds !== this.space.decaySeconds || space.damping !== this.space.damping;
    if (space.preDelayMilliseconds !== this.space.preDelayMilliseconds) {
      this.preDelay.delayTime.setTargetAtTime(space.preDelayMilliseconds / 1000,now,BLEND_TIME_CONSTANT_SECONDS);
    }
    this.space = space;
    const mix = settings.enabled ? settings.mix : 0;
    if (!this.response) {
      if (mix > 0) this.replaceResponse();
    } else if (responseChanged) {
      clearTimeout(this.responseTimer);
      this.responseTimer = setTimeout(() => this.replaceResponse(),RESPONSE_EDIT_DELAY_MILLISECONDS);
    }
    this.dryGain.gain.setTargetAtTime(1 - mix, now, BLEND_TIME_CONSTANT_SECONDS);
    this.wetGain.gain.setTargetAtTime(mix, now, BLEND_TIME_CONSTANT_SECONDS);
  }

  private createImpulse(): AudioBuffer {
    const {sampleRate} = this.context;
    const {decaySeconds,damping} = this.space;
    const length = Math.round(decaySeconds * sampleRate);
    const impulse = this.context.createBuffer(2,length,sampleRate);
    const dampingFilterStep = 1 - Math.exp(-2 * Math.PI * 1800 / sampleRate);
    const highBandDecay = Math.exp(-8 * damping / length);
    let seed = this.noiseSeed;
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const samples = impulse.getChannelData(channel);
      let softenedNoise = 0;
      let lowBand = 0;
      let highBandGain = 1;
      for (let index = 0; index < length; index++) {
        seed = (Math.imul(1664525,seed) + 1013904223) >>> 0;
        softenedNoise = 0.55 * softenedNoise + 0.45 * (seed / 2 ** 31 - 1);
        lowBand += dampingFilterStep * (softenedNoise - lowBand);
        const elapsed = index / length;
        samples[index] = (lowBand + (softenedNoise - lowBand) * highBandGain) * (1 - elapsed) ** 3;
        highBandGain *= highBandDecay;
      }
    }
    return impulse;
  }

  private disconnectResponse(response: ReverbResponse): void {
    this.preDelay.disconnect(response.convolver);
    response.convolver.disconnect();
    response.level.disconnect();
  }

  private replaceResponse(): void {
    const convolver = this.context.createConvolver();
    convolver.buffer = this.createImpulse();
    const level = this.context.createGain();
    const previous = this.response;
    level.gain.value = previous ? 0 : 1;
    this.preDelay.connect(convolver).connect(level).connect(this.wetGain);
    this.response = {convolver,level};
    if (!previous) return;
    clearTimeout(this.cleanupTimer);
    if (this.outgoingResponse) this.disconnectResponse(this.outgoingResponse);
    this.outgoingResponse = previous;
    const now = this.context.currentTime;
    previous.level.gain.setValueAtTime(1,now).linearRampToValueAtTime(0,now + RESPONSE_CROSSFADE_SECONDS);
    level.gain.setValueAtTime(0,now).linearRampToValueAtTime(1,now + RESPONSE_CROSSFADE_SECONDS);
    this.cleanupTimer = setTimeout(() => {
      this.disconnectResponse(previous);
      this.outgoingResponse = undefined;
    },RESPONSE_CROSSFADE_SECONDS * 1000 + 20);
  }

  dispose(): void {
    clearTimeout(this.responseTimer);
    clearTimeout(this.cleanupTimer);
    if (this.response) this.disconnectResponse(this.response);
    if (this.outgoingResponse) this.disconnectResponse(this.outgoingResponse);
    this.mixControl?.stop();
    this.mixControl?.disconnect();
    for (const weight of this.mixWeights) weight.disconnect();
    this.input.disconnect();
    this.preDelay.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.output.disconnect();
  }
}
