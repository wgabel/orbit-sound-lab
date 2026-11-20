import { DEFAULT_DRONE_EFFECT_ORDER, DEFAULT_DRONE_EFFECTS } from '@domain/drone-effects';
import type { ChorusSettings, CompressorSettings, DroneEffectId, FlangerSettings, OverdriveSettings } from '@domain/drone-effects';
import type { DroneMixSettings } from '@domain/drone';
import { WebAudioDelay } from './web-audio-delay';
import { createCompressor, createOverdrive } from './web-audio-drone-drive-and-compression';
import { WebAudioEffectStage } from './web-audio-effect-stage';
import { createFlanger, createStereoChorus } from './web-audio-modulated-delay';
import { WebAudioReverb } from './web-audio-reverb';
import { WebAudioShelfEq } from './web-audio-shelf-eq';
import { fadeGain, PLAYBACK_FADE_SECONDS } from './web-audio-fade';

interface EffectConnection {
  readonly input: AudioNode;
  readonly output: AudioNode;
}

export class WebAudioDroneEffects {
  readonly input: GainNode;
  private readonly output: GainNode;
  private readonly eq: WebAudioShelfEq;
  private readonly overdrive: WebAudioEffectStage<OverdriveSettings>;
  private readonly compressor: WebAudioEffectStage<CompressorSettings>;
  private readonly chorus: WebAudioEffectStage<ChorusSettings>;
  private readonly flanger: WebAudioEffectStage<FlangerSettings>;
  private readonly delay: WebAudioDelay;
  private readonly reverb: WebAudioReverb;
  private readonly stages: Readonly<Record<DroneEffectId, EffectConnection>>;
  private connectedOrder: readonly DroneEffectId[];
  private requestedOrder: readonly DroneEffectId[];
  private reorderClock: ConstantSourceNode | undefined;

  constructor(private readonly context: AudioContext, settings: DroneMixSettings, output: AudioNode) {
    const effects = settings.effects ?? DEFAULT_DRONE_EFFECTS;
    this.eq = new WebAudioShelfEq(context,settings,effects.eqEnabled);
    this.overdrive = new WebAudioEffectStage(context,effects.overdrive,initial => createOverdrive(context,initial));
    this.compressor = new WebAudioEffectStage(context,effects.compressor,initial => createCompressor(context,initial));
    this.chorus = new WebAudioEffectStage(context,effects.chorus,initial => createStereoChorus(context,initial));
    this.flanger = new WebAudioEffectStage(context,effects.flanger,initial => createFlanger(context,initial));
    this.delay = new WebAudioDelay(context,effects.delay);
    this.reverb = new WebAudioReverb(context,settings.reverb);
    this.stages = {
      eq:{input:this.eq.lowShelf,output:this.eq.highShelf}, overdrive:this.overdrive,
      compressor:this.compressor, chorus:this.chorus, flanger:this.flanger, delay:this.delay, reverb:this.reverb
    };
    this.input = context.createGain();
    this.output = context.createGain();
    this.output.connect(output);
    this.connectedOrder = this.requestedOrder = effects.order ?? DEFAULT_DRONE_EFFECT_ORDER;
    this.connectStages(this.connectedOrder);
  }

  private connectStages(order: readonly DroneEffectId[]): void {
    let previous: AudioNode = this.input;
    for (const effect of order) {
      previous.connect(this.stages[effect].input);
      previous = this.stages[effect].output;
    }
    previous.connect(this.output);
  }

  private disconnectStages(order: readonly DroneEffectId[]): void {
    let previous: AudioNode = this.input;
    for (const effect of order) {
      previous.disconnect(this.stages[effect].input);
      previous = this.stages[effect].output;
    }
    previous.disconnect(this.output);
  }

  private requestOrder(order: readonly DroneEffectId[], now: number): void {
    this.requestedOrder = order;
    if (this.reorderClock || order.every((effect,index) => this.connectedOrder[index] === effect)) return;
    fadeGain(this.output.gain,0,now);
    const clock = this.context.createConstantSource();
    this.reorderClock = clock;
    clock.offset.value = 0;
    clock.connect(this.output);
    clock.onended = () => {
      clock.disconnect();
      this.reorderClock = undefined;
      // Replace the serial connections together after the fade reaches zero.
      this.disconnectStages(this.connectedOrder);
      this.connectedOrder = this.requestedOrder;
      this.connectStages(this.connectedOrder);
      fadeGain(this.output.gain,1,this.context.currentTime);
    };
    clock.start(now);
    clock.stop(now + PLAYBACK_FADE_SECONDS);
  }

  update(settings: DroneMixSettings, now: number): void {
    const effects = settings.effects ?? DEFAULT_DRONE_EFFECTS;
    this.eq.update(settings,now,effects.eqEnabled);
    this.overdrive.update(effects.overdrive,now);
    this.compressor.update(effects.compressor,now);
    this.chorus.update(effects.chorus,now);
    this.flanger.update(effects.flanger,now);
    this.delay.update(effects.delay);
    this.reverb.update(settings.reverb,now);
    this.requestOrder(effects.order ?? DEFAULT_DRONE_EFFECT_ORDER,now);
  }

  dispose(): void {
    if (this.reorderClock) {
      this.reorderClock.onended = null;
      this.reorderClock.disconnect();
      this.reorderClock = undefined;
    }
    this.input.disconnect();
    this.output.disconnect();
    this.eq.dispose();
    this.overdrive.dispose();
    this.compressor.dispose();
    this.chorus.dispose();
    this.flanger.dispose();
    this.delay.dispose();
    this.reverb.dispose();
  }
}
