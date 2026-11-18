import type { OscillatorModulationRoute } from '../../domain/oscillator-modulation';

const NEGATIVE_HALF = new Float32Array([-1, 0, 0]);
const POSITIVE_HALF = new Float32Array([0, 0, 1]);
const ROUTE_FADE_SECONDS = 0.008;

/** Scale each half of the bounded waveform so the base value stays put at the slider limits. */
export class WebAudioOscillatorModulation {
  private readonly negative: GainNode;
  private readonly positive: GainNode;
  private readonly negativeHalf: WaveShaperNode;
  private readonly positiveHalf: WaveShaperNode;
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly context: BaseAudioContext,
    readonly route: OscillatorModulationRoute,
    private readonly source: AudioNode,
    destinations: readonly AudioParam[]
  ) {
    this.negativeHalf = context.createWaveShaper();
    this.negativeHalf.curve = NEGATIVE_HALF;
    this.positiveHalf = context.createWaveShaper();
    this.positiveHalf.curve = POSITIVE_HALF;
    this.negative = context.createGain();
    this.positive = context.createGain();
    this.negative.gain.value = this.positive.gain.value = 0;
    source.connect(this.negativeHalf).connect(this.negative);
    source.connect(this.positiveHalf).connect(this.positive);
    for (const parameter of destinations) {
      this.negative.connect(parameter);
      this.positive.connect(parameter);
    }
  }

  update(negativeDepth: number, positiveDepth: number): void {
    const smoothingSeconds = this.route.parameter === 'cutoff' ? 0.02 : 0.015;
    this.setDepth(negativeDepth, positiveDepth, smoothingSeconds);
  }

  fadeOut(afterFade: () => void): void {
    this.setDepth(0, 0, ROUTE_FADE_SECONDS);
    this.cleanupTimer = setTimeout(afterFade, 50);
  }

  private setDepth(negativeDepth: number, positiveDepth: number, smoothingSeconds: number): void {
    this.negative.gain.setTargetAtTime(negativeDepth, this.context.currentTime, smoothingSeconds);
    this.positive.gain.setTargetAtTime(positiveDepth, this.context.currentTime, smoothingSeconds);
  }

  dispose(): void {
    clearTimeout(this.cleanupTimer);
    this.source.disconnect(this.negativeHalf);
    this.source.disconnect(this.positiveHalf);
    this.negativeHalf.disconnect();
    this.positiveHalf.disconnect();
    this.negative.disconnect();
    this.positive.disconnect();
  }
}
