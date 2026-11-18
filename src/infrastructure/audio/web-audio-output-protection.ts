const PEAK_LIMITER_KNEE = 0.85;
const PEAK_LIMITER_CEILING = 0.97;
const PEAK_LIMITER_INPUT_RANGE = 4;
const PEAK_LIMITER_CURVE_STEPS = 4096;

export function limitOutputPeak(sample: number): number {
  const magnitude = Math.abs(sample);
  if (magnitude <= PEAK_LIMITER_KNEE) return sample;
  const headroom = PEAK_LIMITER_CEILING - PEAK_LIMITER_KNEE;
  const limited = PEAK_LIMITER_KNEE - headroom * Math.expm1(-(magnitude - PEAK_LIMITER_KNEE) / headroom);
  return Math.sign(sample) * limited;
}

const peakLimiterCurve = Float32Array.from({length: PEAK_LIMITER_CURVE_STEPS + 1}, (_, index) =>
  limitOutputPeak((2 * index / PEAK_LIMITER_CURVE_STEPS - 1) * PEAK_LIMITER_INPUT_RANGE));

/** Cleans the combined signal and catches peaks that exceed the compressor's headroom. */
export class WebAudioOutputProtection {
  readonly input: BiquadFilterNode;
  readonly output: WaveShaperNode;
  private readonly lowPass: BiquadFilterNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly peakLimiterInput: GainNode;

  constructor(context: AudioContext) {
    this.input = context.createBiquadFilter();
    this.input.type = 'highpass';
    this.input.frequency.value = 25;
    this.input.Q.value = Math.SQRT1_2;
    this.lowPass = context.createBiquadFilter();
    this.lowPass.type = 'lowpass';
    this.lowPass.frequency.value = Math.min(16000, context.sampleRate * 0.4);
    this.lowPass.Q.value = Math.SQRT1_2;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.2;
    this.peakLimiterInput = context.createGain();
    this.peakLimiterInput.gain.value = 1 / PEAK_LIMITER_INPUT_RANGE;
    this.output = context.createWaveShaper();
    this.output.curve = peakLimiterCurve;

    this.input.connect(this.lowPass).connect(this.compressor)
      .connect(this.peakLimiterInput).connect(this.output);
  }

  dispose(): void {
    this.input.disconnect();
    this.lowPass.disconnect();
    this.compressor.disconnect();
    this.peakLimiterInput.disconnect();
    this.output.disconnect();
  }
}
