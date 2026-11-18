/**
 * Protects the combined signal, without changing oscillator pitches.
 * High-pass removes sub-bass/DC; low-pass attenuates extreme highs;
 * compressor controls overlapping oscillator peaks.
 */
export class WebAudioOutputProtection {
  readonly input: BiquadFilterNode;
  readonly output: DynamicsCompressorNode;
  private readonly lowPass: BiquadFilterNode;
  constructor(context: AudioContext) {
    this.input = context.createBiquadFilter();
    this.input.type = 'highpass';
    this.input.frequency.value = 25;
    this.input.Q.value = Math.SQRT1_2;
    this.lowPass = context.createBiquadFilter();
    this.lowPass.type = 'lowpass';
    this.lowPass.frequency.value = Math.min(16000, context.sampleRate * 0.4);
    this.lowPass.Q.value = Math.SQRT1_2;
    this.output = context.createDynamicsCompressor();
    this.output.threshold.value = -12;
    this.output.knee.value = 12;
    this.output.ratio.value = 3;
    this.output.attack.value = 0.005;
    this.output.release.value = 0.2;
    this.input.connect(this.lowPass);
    this.lowPass.connect(this.output);
  }
  dispose(): void {
    this.input.disconnect();
    this.lowPass.disconnect();
    this.output.disconnect();
  }
}
