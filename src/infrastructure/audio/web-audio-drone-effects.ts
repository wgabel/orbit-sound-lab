import { DEFAULT_DRONE_EFFECTS } from '../../domain/drone-effects';
import type { ChorusSettings, CompressorSettings, FlangerSettings, OverdriveSettings } from '../../domain/drone-effects';
import type { DroneMixSettings } from '../../domain/drone';
import { WebAudioDelay } from './web-audio-delay';
import { createCompressor, createOverdrive } from './web-audio-drone-drive-and-compression';
import { WebAudioEffectStage } from './web-audio-effect-stage';
import { createFlanger, createStereoChorus } from './web-audio-modulated-delay';
import { WebAudioReverb } from './web-audio-reverb';
import { WebAudioShelfEq } from './web-audio-shelf-eq';

export class WebAudioDroneEffects {
  readonly input: AudioNode;
  private readonly eq: WebAudioShelfEq;
  private readonly overdrive: WebAudioEffectStage<OverdriveSettings>;
  private readonly compressor: WebAudioEffectStage<CompressorSettings>;
  private readonly chorus: WebAudioEffectStage<ChorusSettings>;
  private readonly flanger: WebAudioEffectStage<FlangerSettings>;
  private readonly delay: WebAudioDelay;
  private readonly reverb: WebAudioReverb;

  constructor(context: AudioContext, settings: DroneMixSettings, output: AudioNode) {
    const effects = settings.effects ?? DEFAULT_DRONE_EFFECTS;
    this.eq = new WebAudioShelfEq(context,settings,effects.eqEnabled);
    this.overdrive = new WebAudioEffectStage(context,effects.overdrive,initial => createOverdrive(context,initial));
    this.compressor = new WebAudioEffectStage(context,effects.compressor,initial => createCompressor(context,initial));
    this.chorus = new WebAudioEffectStage(context,effects.chorus,initial => createStereoChorus(context,initial));
    this.flanger = new WebAudioEffectStage(context,effects.flanger,initial => createFlanger(context,initial));
    this.delay = new WebAudioDelay(context,effects.delay);
    this.reverb = new WebAudioReverb(context,settings.reverb);
    this.input = this.eq.lowShelf;
    this.eq.highShelf.connect(this.overdrive.input);
    this.overdrive.output.connect(this.compressor.input);
    this.compressor.output.connect(this.chorus.input);
    this.chorus.output.connect(this.flanger.input);
    this.flanger.output.connect(this.delay.input);
    this.delay.output.connect(this.reverb.input);
    this.reverb.output.connect(output);
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
  }

  dispose(): void {
    this.eq.dispose();
    this.overdrive.dispose();
    this.compressor.dispose();
    this.chorus.dispose();
    this.flanger.dispose();
    this.delay.dispose();
    this.reverb.dispose();
  }
}
