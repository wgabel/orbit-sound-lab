import type { ModulationSource, ModulationSourceFactory } from '../../application/modulation-contracts';
import type { LowFrequencyOscillatorSettings } from '../../domain/modulation';
import { validateLowFrequencyOscillatorSettings } from '../../domain/modulation';
export class WebAudioLowFrequencyOscillator implements ModulationSource {
  readonly output: GainNode;
  private readonly oscillator: OscillatorNode;
  private readonly limiter: WaveShaperNode;
  private readonly smoother: BiquadFilterNode;
  private started = false;
  private disposed = false;
  constructor(private readonly context: AudioContext, settings: LowFrequencyOscillatorSettings) {
    validateLowFrequencyOscillatorSettings(settings);
    this.oscillator = context.createOscillator();
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.limiter = context.createWaveShaper();
    // Band-limited square and saw waves can overshoot their nominal ±1.
    this.limiter.curve = new Float32Array([-1, 0, 1]);
    this.smoother = context.createBiquadFilter();
    this.smoother.type = 'lowpass';
    this.smoother.frequency.value = 80;
    this.smoother.Q.value = 20 * Math.log10(0.5);
    this.oscillator.connect(this.limiter).connect(this.smoother).connect(this.output);
    this.update(settings);
  }
  start(): void { if (this.disposed) throw new Error('LFO disposed.'); if (!this.started) { this.oscillator.start(); this.started = true; } }
  update(settings: LowFrequencyOscillatorSettings): void {
    if (this.disposed) throw new Error('LFO disposed.');
    validateLowFrequencyOscillatorSettings(settings);
    this.oscillator.type = settings.waveform;
    this.oscillator.frequency.setTargetAtTime(settings.frequencyHz, this.context.currentTime, 0.015);
    this.output.gain.setTargetAtTime(settings.enabled ? (settings.destination === 'pitch' ? settings.depthCents : settings.destination === 'amplitude' ? settings.depthAmplitude : settings.depthHz) : 0, this.context.currentTime, 0.02);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.started) this.oscillator.stop();
    this.oscillator.disconnect(); this.limiter.disconnect(); this.smoother.disconnect(); this.output.disconnect();
  }
}
export class WebAudioLowFrequencyOscillatorFactory implements ModulationSourceFactory {
  constructor(private readonly context: AudioContext) {}
  create(settings: LowFrequencyOscillatorSettings): ModulationSource { return new WebAudioLowFrequencyOscillator(this.context, settings); }
}
