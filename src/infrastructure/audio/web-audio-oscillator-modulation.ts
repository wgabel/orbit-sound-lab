import type { OscillatorModulationRoute } from '../../domain/oscillator-modulation';

/** Applies a signed depth to a normalized level signal and exposes the actual modulation offset. */
export class WebAudioOscillatorModulation {
  readonly analyser: AnalyserNode;
  private readonly depth: GainNode;
  private readonly output: GainNode;
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly context: BaseAudioContext,
    readonly route: OscillatorModulationRoute,
    private readonly source: AudioNode,
    destinations: readonly AudioParam[],
    outputScale: number
  ) {
    this.depth = context.createGain();
    this.depth.gain.value = 0;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 32;
    this.output = context.createGain();
    this.output.gain.value = outputScale;
    source.connect(this.depth).connect(this.analyser).connect(this.output);
    for (const parameter of destinations) this.output.connect(parameter);
  }

  update(depth: number): void {
    const smoothing = this.route.parameter === 'cutoff' ? 0.02 : 0.015;
    this.depth.gain.setTargetAtTime(depth, this.context.currentTime, smoothing);
  }

  fadeOut(afterFade: () => void): void {
    this.depth.gain.setTargetAtTime(0, this.context.currentTime, 0.008);
    this.cleanupTimer = setTimeout(afterFade, 50);
  }

  dispose(): void {
    clearTimeout(this.cleanupTimer);
    this.source.disconnect(this.depth);
    this.depth.disconnect();
    this.analyser.disconnect();
    this.output.disconnect();
  }
}
