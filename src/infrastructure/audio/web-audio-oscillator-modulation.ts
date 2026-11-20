import type { OscillatorModulationRoute } from '@domain/oscillator-modulation';

const NEGATIVE_HALF = new Float32Array([-1, 0, 0]);
const POSITIVE_HALF = new Float32Array([0, 0, 1]);

/** Scale the two sides of the level signal to the space available around the base value. */
export class WebAudioOscillatorModulation {
  readonly analyser: AnalyserNode;
  private readonly negativeHalf: WaveShaperNode;
  private readonly positiveHalf: WaveShaperNode;
  private readonly negativeDepth: GainNode;
  private readonly positiveDepth: GainNode;
  private readonly output: GainNode;
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly context: BaseAudioContext,
    readonly route: OscillatorModulationRoute,
    private readonly source: AudioNode,
    destinations: readonly AudioParam[],
    outputScale: number
  ) {
    this.negativeHalf = context.createWaveShaper();
    this.negativeHalf.curve = NEGATIVE_HALF;
    this.positiveHalf = context.createWaveShaper();
    this.positiveHalf.curve = POSITIVE_HALF;
    this.negativeDepth = context.createGain();
    this.positiveDepth = context.createGain();
    this.negativeDepth.gain.value = this.positiveDepth.gain.value = 0;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 32;
    this.output = context.createGain();
    this.output.gain.value = outputScale;
    source.connect(this.negativeHalf).connect(this.negativeDepth).connect(this.analyser);
    source.connect(this.positiveHalf).connect(this.positiveDepth).connect(this.analyser);
    this.analyser.connect(this.output);
    for (const parameter of destinations) this.output.connect(parameter);
  }

  update(negativeDepth: number, positiveDepth: number): void {
    this.setDepth(negativeDepth, positiveDepth, this.route.parameter === 'cutoff' ? 0.02 : 0.015);
  }

  fadeOut(afterFade: () => void): void {
    this.setDepth(0, 0, 0.008);
    this.cleanupTimer = setTimeout(afterFade, 50);
  }

  private setDepth(negativeDepth: number, positiveDepth: number, smoothing: number): void {
    const now = this.context.currentTime;
    this.negativeDepth.gain.setTargetAtTime(negativeDepth, now, smoothing);
    this.positiveDepth.gain.setTargetAtTime(positiveDepth, now, smoothing);
  }

  dispose(): void {
    clearTimeout(this.cleanupTimer);
    this.source.disconnect(this.negativeHalf);
    this.source.disconnect(this.positiveHalf);
    this.negativeHalf.disconnect();
    this.positiveHalf.disconnect();
    this.negativeDepth.disconnect();
    this.positiveDepth.disconnect();
    this.analyser.disconnect();
    this.output.disconnect();
  }
}
