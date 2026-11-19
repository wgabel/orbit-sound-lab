export interface EffectProcessor<Settings> {
  readonly input: AudioNode;
  readonly output: AudioNode;
  update(settings: Settings, now: number): void;
  dispose(): void;
}

interface BlendSettings {
  readonly enabled: boolean;
  readonly mix?: number;
}

/** Build the wet processor only when the effect is first used. */
export class WebAudioEffectStage<Settings extends BlendSettings> {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private processor: EffectProcessor<Settings> | undefined;

  constructor(context: BaseAudioContext, initial: Settings,
    private readonly createProcessor: (settings: Settings) => EffectProcessor<Settings>) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.dry = context.createGain();
    this.wet = context.createGain();
    const mix = initial.enabled ? initial.mix ?? 1 : 0;
    this.dry.gain.value = 1 - mix;
    this.wet.gain.value = mix;
    this.input.connect(this.dry).connect(this.output);
    this.wet.connect(this.output);
    if (initial.enabled) this.connectProcessor(initial);
  }

  private connectProcessor(settings: Settings): void {
    this.processor = this.createProcessor(settings);
    this.input.connect(this.processor.input);
    this.processor.output.connect(this.wet);
  }

  update(settings: Settings, now: number): void {
    if (this.processor) this.processor.update(settings,now);
    else if (settings.enabled) this.connectProcessor(settings);
    const mix = settings.enabled ? settings.mix ?? 1 : 0;
    this.dry.gain.setTargetAtTime(1 - mix,now,0.015);
    this.wet.gain.setTargetAtTime(mix,now,0.015);
  }

  dispose(): void {
    this.input.disconnect();
    this.processor?.dispose();
    this.dry.disconnect();
    this.wet.disconnect();
    this.output.disconnect();
  }
}
